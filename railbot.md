# RAILBOT — AI Assistant Architecture & Design Document
*(Living document — check off items as completed)*

---

## Overview

RailBot is the AI assistant for RailCommand, providing natural language access to project data, intelligent summarization, and guided data entry for construction/rail project management. It uses **OpenAI GPT-4o / GPT-4o-mini** with function calling to interact with existing Supabase data through the established server action layer.

**Key principles:**
- Read-heavy by default — never mutate data without explicit user confirmation
- RBAC-aware — RailBot respects the same permission matrix as the rest of the app
- Context-scoped — every conversation is scoped to a project and a user's role within it
- Streaming-first — responses stream token-by-token for a responsive feel

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT                                                         │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │ Any Page     │    │ RailBot Slide-Over Panel              │   │
│  │              │───>│  - Message list (streaming)           │   │
│  │ [Bot FAB]   │    │  - Input bar (Cmd+Enter to send)     │   │
│  └──────────────┘    │  - Conversation history sidebar      │   │
│                      └──────────────┬───────────────────────┘   │
│                                     │                           │
│                          POST /api/chat                         │
│                          (SSE stream)                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│  SERVER (Next.js API Route)                                     │
│                                                                 │
│  1. Authenticate user (Supabase session from cookie)            │
│  2. Load user profile + project membership + permissions        │
│  3. Build dynamic system prompt (role-scoped)                   │
│  4. Select model (GPT-4o-mini or GPT-4o)                       │
│  5. Call OpenAI Chat Completions (streaming)                    │
│  6. Handle function calls → execute server actions              │
│  7. Stream response back to client via SSE                      │
│  8. Persist conversation to Supabase                            │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────────┐   │
│  │ OpenAI SDK │  │ Supabase   │  │ Server Actions          │   │
│  │ (GPT-4o)   │  │ Admin      │  │ /src/lib/actions/*      │   │
│  └────────────┘  └────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Model selection strategy:**
| Query type | Model | Examples |
|---|---|---|
| Simple lookups, status checks | `gpt-4o-mini` | "How many open RFIs?" / "What's SUB-003 status?" |
| Complex reasoning, summaries, multi-step | `gpt-4o` | "Summarize this week's progress" / "What's blocking the track installation milestone?" |

The classifier is a lightweight heuristic on the server: if the message contains summarization keywords, multi-entity references, or is a follow-up in a long conversation (>6 messages), route to GPT-4o. Otherwise, default to GPT-4o-mini.

---

## 2. API Integration

### API Route: `/api/chat`

```typescript
// src/app/api/chat/route.ts

import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { buildSystemPrompt } from '@/lib/railbot/system-prompt';
import { RAILBOT_TOOLS } from '@/lib/railbot/tools';
import { executeTool } from '@/lib/railbot/tool-executor';
import { selectModel } from '@/lib/railbot/model-selector';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // server-side only
});

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse request
  const { messages, projectId, conversationId } = await req.json();

  // 3. Load user context
  const { profile, membership, permissions } = await loadUserContext(
    supabase, user.id, projectId
  );
  if (!membership) {
    return Response.json({ error: 'Not a project member' }, { status: 403 });
  }

  // 4. Build system prompt
  const systemPrompt = buildSystemPrompt({
    profile,
    membership,
    permissions,
    projectId,
  });

  // 5. Select model
  const model = selectModel(messages);

  // 6. Call OpenAI with streaming
  const stream = await openai.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    tools: RAILBOT_TOOLS,
    stream: true,
  });

  // 7. Stream response via SSE
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let functionCallBuffer: Record<string, string> = {};

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Handle function calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const id = toolCall.id ?? '';
            if (toolCall.function?.name) {
              functionCallBuffer[id] = '';
              // Accumulate arguments
            }
            if (toolCall.function?.arguments) {
              functionCallBuffer[id] += toolCall.function.arguments;
            }
          }
        }

        // Handle text content
        if (delta?.content) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`)
          );
        }

        // Handle finish
        if (chunk.choices[0]?.finish_reason === 'tool_calls') {
          // Execute tools with permission checking
          const toolResults = await executeTool(
            functionCallBuffer, membership.project_role, projectId, supabase
          );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'tool_result', results: toolResults })}\n\n`)
          );
          // Continue conversation with tool results (second OpenAI call)
        }

        if (chunk.choices[0]?.finish_reason === 'stop') {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### Rate Limiting

```typescript
// src/lib/railbot/rate-limit.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// 20 messages per minute per user
export const rateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  analytics: true,
  prefix: 'railbot',
});

// In API route:
const { success, remaining } = await rateLimiter.limit(user.id);
if (!success) {
  return Response.json(
    { error: 'Rate limit exceeded. Please wait a moment.' },
    { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
  );
}
```

### Error Handling

All errors return structured JSON with user-friendly messages:

| Scenario | Status | Response |
|---|---|---|
| Not authenticated | 401 | `{ error: "Please sign in to use RailBot." }` |
| Not a project member | 403 | `{ error: "You don't have access to this project." }` |
| Rate limited | 429 | `{ error: "Rate limit exceeded. Please wait a moment." }` |
| OpenAI API error | 502 | `{ error: "RailBot is temporarily unavailable. Please try again." }` |
| Invalid request body | 400 | `{ error: "Invalid request." }` |

---

## 3. System Prompt Design

The system prompt is **dynamically built per request** based on the user's role, permissions, and current project context.

### System Prompt Template

```typescript
// src/lib/railbot/system-prompt.ts

import { canPerform, getAllowedActions, ACTIONS } from '@/lib/permissions';
import type { Profile, ProjectMember, Project } from '@/lib/types';

interface SystemPromptContext {
  profile: Profile;
  membership: ProjectMember;
  permissions: string[];
  projectId: string;
  projectSummary?: ProjectSummary;
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const { profile, membership, permissions, projectSummary } = ctx;

  const canBudget = canPerform(membership.project_role, ACTIONS.BUDGET_VIEW);
  const canCreateRFI = canPerform(membership.project_role, ACTIONS.RFI_CREATE);
  const canCreatePunch = canPerform(membership.project_role, ACTIONS.PUNCH_LIST_CREATE);
  const canCreateLog = canPerform(membership.project_role, ACTIONS.DAILY_LOG_CREATE);
  const canReviewSubmittals = canPerform(membership.project_role, ACTIONS.SUBMITTAL_REVIEW);

  return `You are RailBot, the AI assistant for RailCommand — a construction project management platform built for railroad and infrastructure projects.

## Your Identity
- You are helpful, concise, and construction-industry-aware.
- You speak in clear, professional language. Avoid jargon unless the user uses it first.
- You are part of the RailCommand application, not a general-purpose chatbot.

## Current Context
- **User**: ${profile.full_name} (${profile.email})
- **Organization**: ${profile.organization?.name ?? 'Unknown'}
- **Org Role**: ${profile.role}
- **Project Role**: ${membership.project_role}
- **Allowed Actions**: ${permissions.join(', ')}
${projectSummary ? `
## Project Snapshot
- **Project**: ${projectSummary.name}
- **Status**: ${projectSummary.status}
- **Location**: ${projectSummary.location}
- **Open Submittals**: ${projectSummary.openSubmittals}
- **Open RFIs**: ${projectSummary.openRFIs}
- **Open Punch Items**: ${projectSummary.openPunchItems}
- **Overdue Items**: ${projectSummary.overdueCount}
${canBudget ? `- **Budget**: $${projectSummary.budgetSpent.toLocaleString()} / $${projectSummary.budgetTotal.toLocaleString()} (${projectSummary.budgetPercent}%)` : '- **Budget**: [restricted — user does not have budget:view permission]'}
` : ''}
## Behavioral Rules
1. **Read-first**: Default to looking up and reporting data. Never create, update, or delete records without the user explicitly asking.
2. **Confirm before writes**: When the user asks to create or update something, show them exactly what will be created and ask for confirmation before executing.
3. **Respect permissions**: You can only perform actions the user is allowed to perform. Their allowed actions are listed above. If they ask for something outside their permissions, politely explain they don't have access.
${!canBudget ? '4. **Budget restriction**: This user does NOT have budget:view permission. Do not reveal budget figures, even if you have access to the data.' : ''}
${!canReviewSubmittals ? '5. **Submittal review restriction**: This user cannot approve or reject submittals.' : ''}
4. **Stay scoped**: Only discuss data from the current project. Do not reference other projects or make up data.
5. **Use tools**: When the user asks about project data, use the available functions to fetch real data rather than guessing.
6. **Format clearly**: Use markdown formatting for readability. Use tables for lists of items. Use bullet points for summaries.

## What You Can Help With
- Look up submittals, RFIs, punch list items, daily logs, and milestones
- Summarize project status, overdue items, and recent activity
- Filter and search across modules by status, priority, assignee, and date
${canCreateRFI ? '- Create new RFIs (with confirmation)' : ''}
${canCreatePunch ? '- Create new punch list items (with confirmation)' : ''}
${canCreateLog ? '- Create new daily log entries (with confirmation)' : ''}
${canBudget ? '- Report on budget health and spending' : ''}

## What You Cannot Do
- Access data from other projects
- Perform actions outside the user's permission set
- Delete any records
- Modify user roles or project settings
- Access file attachments or photos directly`;
}
```

### Key Design Decisions

1. **Permission injection**: The system prompt explicitly lists the user's allowed actions. This serves as a first layer of defense. The real enforcement happens at the function execution layer (see Section 4).

2. **Budget gating**: Budget data is conditionally included. Users without `budget:view` get a redacted line. The tools also enforce this — `get_budget_summary` checks permissions before returning data.

3. **Project snapshot**: A lightweight summary is pre-fetched and injected so the model can answer basic questions ("How many open RFIs?") without a function call. This reduces latency for common queries.

---

## 4. Function Calling / Tools

RailBot uses OpenAI's [function calling](https://platform.openai.com/docs/guides/function-calling) to query and mutate project data through the existing server action layer.

### Tool Definitions

```typescript
// src/lib/railbot/tools.ts

import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const RAILBOT_TOOLS: ChatCompletionTool[] = [
  // ── READ TOOLS ──────────────────────────────────────────────

  {
    type: 'function',
    function: {
      name: 'search_submittals',
      description: 'Search submittals by status, date range, spec section, or assignee. Returns a list of matching submittals with key fields.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'submitted', 'under_review', 'approved', 'conditional', 'rejected'],
            description: 'Filter by submittal status',
          },
          assignee: {
            type: 'string',
            description: 'Filter by assignee name (partial match)',
          },
          date_from: {
            type: 'string',
            description: 'Start date for submit_date range (YYYY-MM-DD)',
          },
          date_to: {
            type: 'string',
            description: 'End date for submit_date range (YYYY-MM-DD)',
          },
          search: {
            type: 'string',
            description: 'Free-text search across title, number, and spec section',
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default 20)',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'search_rfis',
      description: 'Search RFIs by status, priority, assignee, or date range.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'answered', 'closed', 'overdue'],
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
          },
          assignee: {
            type: 'string',
            description: 'Filter by assigned_to name (partial match)',
          },
          date_from: { type: 'string', description: 'YYYY-MM-DD' },
          date_to: { type: 'string', description: 'YYYY-MM-DD' },
          search: { type: 'string', description: 'Free-text search across subject, number, question' },
          limit: { type: 'number' },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'search_punch_list',
      description: 'Search punch list items by status, priority, assignee, or location.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'in_progress', 'resolved', 'verified'],
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
          },
          assignee: { type: 'string' },
          location: { type: 'string', description: 'Filter by location (partial match)' },
          search: { type: 'string' },
          limit: { type: 'number' },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'search_daily_logs',
      description: 'Search daily logs by date range or content.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'YYYY-MM-DD' },
          date_to: { type: 'string', description: 'YYYY-MM-DD' },
          search: { type: 'string', description: 'Search work summary and safety notes' },
          created_by: { type: 'string', description: 'Filter by author name' },
          limit: { type: 'number' },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_project_summary',
      description: 'Get a comprehensive project dashboard summary including KPIs, open item counts, overdue counts, recent activity, and upcoming milestones.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_overdue_items',
      description: 'Get all overdue items across submittals, RFIs, punch list items, and milestones. Returns items grouped by module with days overdue.',
      parameters: {
        type: 'object',
        properties: {
          module: {
            type: 'string',
            enum: ['submittals', 'rfis', 'punch_list', 'milestones', 'all'],
            description: 'Filter to a specific module or "all" (default)',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_budget_summary',
      description: 'Get budget health summary including total budget, spent, remaining, and per-milestone breakdown. Requires budget:view permission.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  // ── WRITE TOOLS (require confirmation) ──────────────────────

  {
    type: 'function',
    function: {
      name: 'create_rfi',
      description: 'Create a new RFI. IMPORTANT: Always show the user what will be created and ask for confirmation BEFORE calling this function.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'RFI subject line' },
          question: { type: 'string', description: 'The detailed question' },
          priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          assigned_to: { type: 'string', description: 'Profile ID of the assignee' },
          due_date: { type: 'string', description: 'YYYY-MM-DD' },
          milestone_id: { type: 'string', description: 'Optional linked milestone ID' },
        },
        required: ['subject', 'question', 'priority', 'assigned_to', 'due_date'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'create_punch_list_item',
      description: 'Create a new punch list item. IMPORTANT: Always show the user what will be created and ask for confirmation BEFORE calling this function.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          location: { type: 'string' },
          priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          assigned_to: { type: 'string', description: 'Profile ID of the assignee' },
          due_date: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['title', 'description', 'location', 'priority', 'assigned_to', 'due_date'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'create_daily_log',
      description: 'Create a new daily log entry. IMPORTANT: Always show the user what will be created and ask for confirmation BEFORE calling this function.',
      parameters: {
        type: 'object',
        properties: {
          log_date: { type: 'string', description: 'YYYY-MM-DD' },
          weather_temp: { type: 'number' },
          weather_conditions: { type: 'string' },
          weather_wind: { type: 'string' },
          work_summary: { type: 'string' },
          safety_notes: { type: 'string' },
          personnel: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                headcount: { type: 'number' },
                company: { type: 'string' },
              },
              required: ['role', 'headcount', 'company'],
            },
          },
          equipment: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                equipment_type: { type: 'string' },
                count: { type: 'number' },
                notes: { type: 'string' },
              },
              required: ['equipment_type', 'count'],
            },
          },
          work_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                location: { type: 'string' },
              },
              required: ['description', 'quantity', 'unit', 'location'],
            },
          },
        },
        required: ['log_date', 'weather_temp', 'weather_conditions', 'work_summary'],
      },
    },
  },
];
```

### Tool Executor with Permission Checking

```typescript
// src/lib/railbot/tool-executor.ts

import { canPerform, ACTIONS, type Action } from '@/lib/permissions';
import type { ProjectMember } from '@/lib/types';

// Map tool names to required permissions
const TOOL_PERMISSIONS: Record<string, Action | null> = {
  search_submittals: null,        // read — all project members
  search_rfis: null,              // read — all project members
  search_punch_list: null,        // read — all project members
  search_daily_logs: null,        // read — all project members
  get_project_summary: null,      // read — all project members
  get_overdue_items: null,        // read — all project members
  get_budget_summary: ACTIONS.BUDGET_VIEW,
  create_rfi: ACTIONS.RFI_CREATE,
  create_punch_list_item: ACTIONS.PUNCH_LIST_CREATE,
  create_daily_log: ACTIONS.DAILY_LOG_CREATE,
};

export async function executeTool(
  toolCalls: Record<string, { name: string; arguments: string }>,
  projectRole: ProjectMember['project_role'],
  projectId: string,
  supabase: SupabaseClient,
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const [callId, call] of Object.entries(toolCalls)) {
    const requiredPermission = TOOL_PERMISSIONS[call.name];

    // Permission gate
    if (requiredPermission && !canPerform(projectRole, requiredPermission)) {
      results.push({
        tool_call_id: callId,
        output: JSON.stringify({
          error: `Permission denied. Your role (${projectRole}) does not have the "${requiredPermission}" permission.`,
        }),
      });
      continue;
    }

    // Execute the appropriate server action
    const args = JSON.parse(call.arguments);
    const output = await executeToolAction(call.name, args, projectId, supabase);
    results.push({ tool_call_id: callId, output: JSON.stringify(output) });
  }

  return results;
}

async function executeToolAction(
  name: string,
  args: Record<string, unknown>,
  projectId: string,
  supabase: SupabaseClient,
): Promise<unknown> {
  switch (name) {
    case 'search_submittals':
      return searchSubmittals(projectId, args, supabase);
    case 'search_rfis':
      return searchRFIs(projectId, args, supabase);
    case 'search_punch_list':
      return searchPunchList(projectId, args, supabase);
    case 'search_daily_logs':
      return searchDailyLogs(projectId, args, supabase);
    case 'get_project_summary':
      return getProjectSummary(projectId, supabase);
    case 'get_overdue_items':
      return getOverdueItems(projectId, args.module as string, supabase);
    case 'get_budget_summary':
      return getBudgetSummary(projectId, supabase);
    case 'create_rfi':
      return createRFI(projectId, args, supabase);
    case 'create_punch_list_item':
      return createPunchListItem(projectId, args, supabase);
    case 'create_daily_log':
      return createDailyLog(projectId, args, supabase);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
```

### Permission Matrix for Tools

| Tool | Required Permission | Roles with Access |
|---|---|---|
| `search_submittals` | None (read) | All project members |
| `search_rfis` | None (read) | All project members |
| `search_punch_list` | None (read) | All project members |
| `search_daily_logs` | None (read) | All project members |
| `get_project_summary` | None (read) | All project members |
| `get_overdue_items` | None (read) | All project members |
| `get_budget_summary` | `budget:view` | manager, superintendent, engineer, owner |
| `create_rfi` | `rfi:create` | manager, superintendent, foreman, engineer, contractor, inspector, owner |
| `create_punch_list_item` | `punch_list:create` | manager, superintendent, foreman, engineer (via verify), inspector, contractor |
| `create_daily_log` | `daily_log:create` | manager, superintendent, foreman, contractor |

---

## 5. Chat UI Component

### Component Structure

```
src/
  components/
    railbot/
      RailBotProvider.tsx        ← Context provider (global state)
      RailBotTrigger.tsx         ← FAB / sidebar icon
      RailBotPanel.tsx           ← Slide-over container
      RailBotMessageList.tsx     ← Scrollable message area
      RailBotMessage.tsx         ← Individual message bubble
      RailBotInput.tsx           ← Text input + send button
      RailBotHistory.tsx         ← Conversation list sidebar
      RailBotTypingIndicator.tsx ← Animated dots during streaming
      RailBotConfirmCard.tsx     ← Confirmation UI for write operations
```

### Panel Behavior

```typescript
// src/components/railbot/RailBotPanel.tsx

'use client';

import { useRailBot } from './RailBotProvider';
import { RailBotMessageList } from './RailBotMessageList';
import { RailBotInput } from './RailBotInput';
import { RailBotHistory } from './RailBotHistory';
import { cn } from '@/lib/utils';
import { X, MessageSquare } from 'lucide-react';

export function RailBotPanel() {
  const { isOpen, close, activeConversation } = useRailBot();

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={close}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full bg-background border-l shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          // Desktop: 420px slide-over. Mobile: full-screen.
          'w-full sm:w-[420px]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">RailBot</h2>
          </div>
          <button onClick={close} className="p-2 hover:bg-muted rounded-md">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col h-[calc(100%-57px)]">
          <RailBotMessageList />
          <RailBotInput />
        </div>
      </div>
    </>
  );
}
```

### Trigger Button

```typescript
// src/components/railbot/RailBotTrigger.tsx

'use client';

import { useRailBot } from './RailBotProvider';
import { Bot } from 'lucide-react';

export function RailBotTrigger() {
  const { toggle, isOpen } = useRailBot();

  return (
    <button
      onClick={toggle}
      className={cn(
        'fixed bottom-6 right-6 z-30 rounded-full p-3.5 shadow-lg',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'transition-all duration-200',
        // Hide on mobile when panel is open (panel goes full-screen)
        isOpen && 'sm:flex hidden',
        // Offset above mobile nav
        'mb-16 sm:mb-0',
      )}
      aria-label="Toggle RailBot"
    >
      <Bot className="h-5 w-5" />
    </button>
  );
}
```

### Interaction Details

- **Open**: Click FAB (bottom-right) or sidebar RailBot icon
- **Close**: Click X, press `Escape`, or tap backdrop on mobile
- **Send message**: Click send button or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
- **New conversation**: Click "New Chat" button in panel header
- **View history**: Click history icon to see past conversations
- **Streaming**: Text appears token-by-token with a blinking cursor indicator
- **Confirmation cards**: Write operations render a card with details + Confirm/Cancel buttons
- **Mobile**: Panel goes full-screen, input sticks to bottom with safe-area padding

---

## 6. Conversation State Management

### React Context

```typescript
// src/components/railbot/RailBotProvider.tsx

'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  functionCall?: { name: string; arguments: string };
  createdAt: Date;
  isStreaming?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RailBotContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  messages: Message[];
  conversations: Conversation[];
  activeConversation: Conversation | null;
  sendMessage: (content: string) => Promise<void>;
  startNewConversation: () => void;
  loadConversation: (id: string) => Promise<void>;
  isLoading: boolean;
}

const RailBotContext = createContext<RailBotContextType | null>(null);

export function RailBotProvider({ children, projectId }: {
  children: React.ReactNode;
  projectId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    // Optimistic update — add user message immediately
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Add placeholder assistant message for streaming
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
      isStreaming: true,
    }]);

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          projectId,
          conversationId: activeConversation?.id,
        }),
        signal: abortRef.current.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') break;

          const parsed = JSON.parse(data);
          if (parsed.type === 'text') {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: m.content + parsed.content }
                  : m
              )
            );
          }
        }
      }

      // Mark streaming complete
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        )
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: 'Something went wrong. Please try again.', isStreaming: false }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, projectId, activeConversation]);

  // ... startNewConversation, loadConversation, etc.

  return (
    <RailBotContext.Provider value={{
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen(prev => !prev),
      messages,
      conversations,
      activeConversation,
      sendMessage,
      startNewConversation: () => {
        setMessages([]);
        setActiveConversation(null);
      },
      loadConversation: async (id) => { /* fetch from Supabase */ },
      isLoading,
    }}>
      {children}
    </RailBotContext.Provider>
  );
}

export function useRailBot() {
  const ctx = useContext(RailBotContext);
  if (!ctx) throw new Error('useRailBot must be used within RailBotProvider');
  return ctx;
}
```

### Auto-Title Generation

After the first assistant response, generate a conversation title:

```typescript
async function generateTitle(firstUserMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Generate a 3-6 word title for this conversation. No quotes. No punctuation at the end.',
      },
      { role: 'user', content: firstUserMessage },
    ],
    max_tokens: 20,
  });
  return response.choices[0].message.content ?? 'New Conversation';
}
```

---

## 7. Data Context Layer

### How Project Data Reaches OpenAI

```
                    ┌─────────────────────────┐
                    │  System Prompt           │
                    │  (static context)        │
                    │  - User role/permissions │
                    │  - Project snapshot KPIs │
                    └────────────┬────────────┘
                                 │
  User: "Show me overdue RFIs"   │
           │                     │
           ▼                     ▼
  ┌─────────────────────────────────────────┐
  │  OpenAI Chat Completions API            │
  │  → Decides to call get_overdue_items()  │
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │  Tool Executor                          │
  │  → Queries Supabase (RLS-scoped)        │
  │  → Returns structured JSON              │
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │  OpenAI (second call with tool results) │
  │  → Formats data into natural language   │
  └─────────────────────────────────────────┘
```

### Context Window Management

**Problem**: A project may have hundreds of submittals, RFIs, and daily logs. Dumping all of this into context would exceed token limits and increase cost.

**Strategy**:

1. **Pre-fetched snapshot**: The system prompt includes a lightweight project summary (counts, overdue totals) so the model can answer basic questions without function calls.

2. **On-demand fetching via tools**: Detailed data is only fetched when the model explicitly calls a tool. Results are paginated (default 20 items per query).

3. **Result summarization**: For large result sets, the tool executor returns a summary rather than raw records:

```typescript
function summarizeResults(items: unknown[], total: number): string {
  if (total <= 20) return JSON.stringify(items);

  // Return first 15 items + summary of the rest
  return JSON.stringify({
    showing: items.slice(0, 15),
    total,
    summary: `Showing 15 of ${total} results. Ask me to filter further or see the next page.`,
  });
}
```

4. **Conversation trimming**: For long conversations, older messages are summarized before being sent to OpenAI. The most recent 10 message pairs are sent in full; older messages are compressed into a single system summary.

### Data Freshness

All tool calls query Supabase in real-time. There is no caching layer — data is always fresh. The project snapshot in the system prompt is fetched at the start of each API request (not cached across requests).

---

## 8. Security Considerations

### API Key Storage

- OpenAI API key stored as `OPENAI_API_KEY` environment variable on Vercel
- Never exposed to the client — only accessed in the `/api/chat` server-side route
- No API key in git, `.env.local` only for development

### Authentication Verification

Every `/api/chat` request:
1. Reads the Supabase session cookie
2. Calls `supabase.auth.getUser()` to verify the session is valid (not just `getSession()` — which can be spoofed)
3. Loads the user's `project_members` row to confirm they belong to the requested project
4. Rejects the request if any check fails

### RBAC Enforcement (Defense in Depth)

RBAC is enforced at **three layers**:

| Layer | What it does | How |
|---|---|---|
| **System prompt** | Tells the model what the user can/cannot do | Dynamic prompt includes allowed actions list |
| **Tool executor** | Blocks unauthorized function calls | `TOOL_PERMISSIONS` map checked before execution |
| **Supabase RLS** | Database-level row security | Queries run through authenticated Supabase client with RLS policies |

The system prompt is the weakest layer (prompt injection could bypass it). The tool executor is the primary gate. Supabase RLS is the last line of defense.

### Input Sanitization

- User messages are plain text only (no HTML rendering)
- Function call arguments are validated against the tool schema before execution
- SQL injection is prevented by using Supabase SDK (parameterized queries)

### Logging Policy

- Conversation content is stored in Supabase (encrypted at rest)
- No PII is logged to Vercel logs or external services
- OpenAI API calls follow OpenAI's data usage policy (API data is not used for training)

---

## 9. Database Schema

### SQL Migrations

```sql
-- ============================================================
-- RailBot Conversations & Messages
-- ============================================================

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB DEFAULT NULL,       -- OpenAI tool_calls array (for assistant messages)
  tool_call_id TEXT DEFAULT NULL,       -- Reference to tool call (for tool messages)
  model TEXT DEFAULT NULL,              -- Which model generated this message
  tokens_used INTEGER DEFAULT NULL,     -- Token count for cost tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────

-- Fast lookup: user's conversations in a project (sorted by recent)
CREATE INDEX idx_conversations_user_project
  ON conversations(user_id, project_id, updated_at DESC);

-- Fast lookup: messages in a conversation (chronological)
CREATE INDEX idx_messages_conversation
  ON messages(conversation_id, created_at ASC);

-- Cleanup: find old conversations
CREATE INDEX idx_conversations_updated
  ON conversations(updated_at);

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own conversations
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Messages: accessible if user owns the parent conversation
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

-- ── Auto-update trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = now(),
      message_count = message_count + 1
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();
```

### Schema Diagram

```
conversations
├── id (PK, UUID)
├── project_id (FK → projects)
├── user_id (FK → auth.users)
├── title (TEXT)
├── model (TEXT)
├── message_count (INTEGER)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

messages
├── id (PK, UUID)
├── conversation_id (FK → conversations, CASCADE)
├── role (TEXT: user | assistant | system | tool)
├── content (TEXT)
├── tool_calls (JSONB, nullable)
├── tool_call_id (TEXT, nullable)
├── model (TEXT, nullable)
├── tokens_used (INTEGER, nullable)
└── created_at (TIMESTAMPTZ)
```

---

## 10. Implementation Phases

### Phase 1: API Route + Basic Chat UI + Streaming
- [ ] Install `openai` npm package
- [ ] Create `/api/chat/route.ts` with auth verification
- [ ] Implement OpenAI streaming with SSE
- [ ] Implement model selection heuristic (GPT-4o-mini default, GPT-4o for complex)
- [ ] Build `RailBotProvider` context with message state
- [ ] Build `RailBotPanel` slide-over component
- [ ] Build `RailBotTrigger` FAB button
- [ ] Build `RailBotMessageList` with streaming text display
- [ ] Build `RailBotInput` with Cmd+Enter send
- [ ] Build `RailBotTypingIndicator`
- [ ] Add basic system prompt (static, no project context yet)
- [ ] Wire up to app layout (provider + trigger on every page)
- [ ] Basic error handling (auth, rate limit, API failures)

### Phase 2: Function Calling — Read-Only Queries
- [ ] Build dynamic system prompt with user role/permissions injection
- [ ] Implement `search_submittals` tool
- [ ] Implement `search_rfis` tool
- [ ] Implement `search_punch_list` tool
- [ ] Implement `search_daily_logs` tool
- [ ] Implement `get_project_summary` tool
- [ ] Implement `get_overdue_items` tool
- [ ] Implement `get_budget_summary` tool (with permission gate)
- [ ] Build tool executor with permission checking layer
- [ ] Handle tool call → result → follow-up response loop
- [ ] Pre-fetch project snapshot for system prompt context
- [ ] Result summarization for large datasets

### Phase 3: Write Operations with Confirmation
- [ ] Implement `create_rfi` tool
- [ ] Implement `create_punch_list_item` tool
- [ ] Implement `create_daily_log` tool
- [ ] Build `RailBotConfirmCard` UI component (shows proposed data, Confirm/Cancel)
- [ ] Implement confirmation flow (model proposes → user confirms → execute)
- [ ] Permission-denied messaging for unauthorized write attempts
- [ ] Success/failure feedback after write operations

### Phase 4: Conversation History Persistence
- [ ] Run SQL migration for `conversations` and `messages` tables
- [ ] Configure RLS policies
- [ ] Persist messages to Supabase after each exchange
- [ ] Auto-generate conversation titles after first response
- [ ] Build `RailBotHistory` component (list of past conversations)
- [ ] Load conversation on select (fetch messages from Supabase)
- [ ] Delete conversation support
- [ ] Conversation trimming for long threads (summarize older messages)

### Phase 5: Rate Limiting + Production Hardening
- [ ] Set up Upstash Redis for rate limiting (or Vercel KV)
- [ ] Implement rate limiter (20 messages/min/user)
- [ ] Rate limit UI feedback (show remaining, disable input when limited)
- [ ] Token usage tracking (log tokens per message for cost monitoring)
- [ ] Input validation (max message length, empty message prevention)
- [ ] Abort in-flight requests when starting a new message
- [ ] Graceful degradation when OpenAI API is down

### Phase 6: Mobile Optimization + Polish
- [ ] Full-screen panel on mobile with safe-area padding
- [ ] Hide FAB when panel is open on mobile
- [ ] Touch-friendly message input (auto-grow textarea, 44px tap targets)
- [ ] Keyboard handling (input stays visible above virtual keyboard)
- [ ] Smooth panel open/close animations
- [ ] Welcome message for new conversations with suggested prompts
- [ ] Empty state design
- [ ] Accessibility audit (ARIA labels, focus management, screen reader support)
- [ ] Update PROJECT.md Phase 11 checklist items

---

## File Structure (Final)

```
src/
  app/
    api/
      chat/
        route.ts                 ← POST handler (streaming SSE)
  lib/
    railbot/
      system-prompt.ts           ← Dynamic system prompt builder
      tools.ts                   ← OpenAI function/tool definitions
      tool-executor.ts           ← Permission-checked tool execution
      model-selector.ts          ← GPT-4o vs GPT-4o-mini routing
      context.ts                 ← Project snapshot pre-fetcher
      rate-limit.ts              ← Rate limiting configuration
  components/
    railbot/
      RailBotProvider.tsx        ← Global context provider
      RailBotTrigger.tsx         ← FAB button
      RailBotPanel.tsx           ← Slide-over container
      RailBotMessageList.tsx     ← Message display area
      RailBotMessage.tsx         ← Individual message bubble
      RailBotInput.tsx           ← Text input + send
      RailBotHistory.tsx         ← Past conversations list
      RailBotTypingIndicator.tsx ← Streaming indicator
      RailBotConfirmCard.tsx     ← Write confirmation card
```

---

## Environment Variables

```bash
# .env.local (add to existing)
OPENAI_API_KEY=sk-...           # OpenAI API key (server-side only)
UPSTASH_REDIS_REST_URL=...      # Rate limiting (optional, Phase 5)
UPSTASH_REDIS_REST_TOKEN=...    # Rate limiting (optional, Phase 5)
```

---

## Dependencies

```bash
npm install openai              # OpenAI SDK
npm install @upstash/ratelimit  # Rate limiting (Phase 5)
npm install @upstash/redis      # Redis client for rate limiting (Phase 5)
```

---

## Cost Estimation

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Typical message cost |
|---|---|---|---|
| GPT-4o-mini | $0.15 | $0.60 | ~$0.001 per message |
| GPT-4o | $2.50 | $10.00 | ~$0.01-0.03 per message |

**Projected cost at scale**: With 80% of queries routed to GPT-4o-mini and 20% to GPT-4o, estimated cost is ~$0.005 per message average. At 1,000 messages/day, that is roughly $150/month.

---

*Last updated: March 30, 2026 — Initial architecture document*
*Product: RailCommand — by A5 Rail*
*Developer: Dillan Milosevich, CTO — Creative Currents LLC*
