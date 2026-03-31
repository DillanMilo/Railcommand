import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { getAllowedActions, canPerform, ACTIONS } from '@/lib/permissions';
import { buildSystemPrompt } from '@/lib/railbot/system-prompt';
import { RAILBOT_TOOLS } from '@/lib/railbot/tools';
import { executeTool, executeDemoTool } from '@/lib/railbot/tool-executor';
import { selectModel } from '@/lib/railbot/model-selector';
import {
  getProfileWithOrg as getSeedProfileWithOrg,
  seedProjectMembers,
  seedSubmittals,
  seedRFIs,
  seedPunchListItems,
  seedMilestones,
  seedProject,
} from '@/lib/seed-data';
import type { ProjectSummary } from '@/lib/railbot/system-prompt';
import type { ChatMessage } from '@/lib/railbot/types';
import type { Profile, ProjectMember } from '@/lib/types';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum number of tool-call round-trips to prevent infinite loops
const MAX_TOOL_ROUNDS = 5;

/**
 * Filter the tools array based on the user's project role so OpenAI only sees
 * tools the user is authorized to use. Read tools are always included; write
 * tools and budget are gated by the permission matrix.
 */
function filterToolsForRole(role: ProjectMember['project_role']): ChatCompletionTool[] {
  return RAILBOT_TOOLS.filter(tool => {
    if (tool.type !== 'function') return true;
    const name = tool.function.name;
    // Always include read-only tools
    if ([
      'search_submittals', 'search_rfis', 'search_punch_list', 'search_daily_logs',
      'get_project_summary', 'get_overdue_items', 'get_milestones',
      'get_team_members', 'get_recent_activity', 'get_daily_log_rollup',
    ].includes(name)) {
      return true;
    }
    // Budget tool only for roles with budget:view
    if (name === 'get_budget_summary') return canPerform(role, ACTIONS.BUDGET_VIEW);
    // Write tools gated by their specific permission
    if (name === 'create_rfi') return canPerform(role, ACTIONS.RFI_CREATE);
    if (name === 'create_punch_list_item') return canPerform(role, ACTIONS.PUNCH_LIST_CREATE);
    if (name === 'create_daily_log') return canPerform(role, ACTIONS.DAILY_LOG_CREATE);
    return true;
  });
}

function getDemoProjectSummary(projectId: string, canViewBudget: boolean): ProjectSummary {
  const today = new Date().toISOString().split('T')[0];
  const subs = seedSubmittals.filter((s) => s.project_id === projectId);
  const rfiItems = seedRFIs.filter((r) => r.project_id === projectId);
  const punch = seedPunchListItems.filter((p) => p.project_id === projectId);
  const ms = seedMilestones.filter((m) => m.project_id === projectId);

  const overdueSubs = subs.filter((s) => s.due_date < today && !['approved', 'rejected'].includes(s.status));
  const overdueRfis = rfiItems.filter((r) => r.due_date < today && !['closed', 'answered'].includes(r.status));
  const overduePunch = punch.filter((p) => p.due_date < today && !['resolved', 'verified'].includes(p.status));

  const summary: ProjectSummary = {
    totalSubmittals: subs.length,
    totalRFIs: rfiItems.length,
    totalPunchList: punch.length,
    totalMilestones: ms.length,
    overdueItems: overdueSubs.length + overdueRfis.length + overduePunch.length,
  };

  if (canViewBudget && seedProject.id === projectId) {
    summary.budgetTotal = seedProject.budget_total;
    summary.budgetSpent = seedProject.budget_spent;
  }

  return summary;
}

async function getSupabaseProjectSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  canViewBudget: boolean,
): Promise<ProjectSummary> {
  const today = new Date().toISOString().split('T')[0];

  const [submittals, rfis, punchList, milestones, overdueSubs, overdueRfis, overduePunch] =
    await Promise.all([
      supabase.from('submittals').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('rfis').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('punch_list_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('milestones').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('submittals').select('id', { count: 'exact', head: true }).eq('project_id', projectId).lt('due_date', today).not('status', 'in', '("approved","rejected")'),
      supabase.from('rfis').select('id', { count: 'exact', head: true }).eq('project_id', projectId).lt('due_date', today).not('status', 'in', '("closed","answered")'),
      supabase.from('punch_list_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId).lt('due_date', today).not('status', 'in', '("resolved","verified")'),
    ]);

  const summary: ProjectSummary = {
    totalSubmittals: submittals.count ?? 0,
    totalRFIs: rfis.count ?? 0,
    totalPunchList: punchList.count ?? 0,
    totalMilestones: milestones.count ?? 0,
    overdueItems: (overdueSubs.count ?? 0) + (overdueRfis.count ?? 0) + (overduePunch.count ?? 0),
  };

  if (canViewBudget) {
    const { data: proj } = await supabase
      .from('projects')
      .select('budget_total, budget_spent')
      .eq('id', projectId)
      .single();
    if (proj) {
      summary.budgetTotal = proj.budget_total;
      summary.budgetSpent = proj.budget_spent;
    }
  }

  return summary;
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse request body ─────────────────────────────────────────
    const body = await request.json();
    const { messages, projectId, isDemo, demoUserId, conversationId: incomingConversationId } = body as {
      messages: ChatMessage[];
      projectId: string;
      isDemo?: boolean;
      demoUserId?: string;
      conversationId?: string;
    };

    if (!projectId || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing projectId or messages' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Input validation ────────────────────────────────────────────
    const MAX_MESSAGE_LENGTH = 2000;
    const MAX_MESSAGES = 50;

    // Limit number of messages in the conversation
    if (messages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({ error: 'Conversation too long. Please start a new chat.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate and sanitize each message
    for (const msg of messages) {
      if (typeof msg.content !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid message format.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      // Truncate excessively long messages
      if (msg.content.length > MAX_MESSAGE_LENGTH) {
        msg.content = msg.content.slice(0, MAX_MESSAGE_LENGTH);
      }
    }

    // Validate projectId format (should be UUID or demo ID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const demoIdRegex = /^proj-\d{3}$/;
    if (!uuidRegex.test(projectId) && !demoIdRegex.test(projectId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid project ID.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Strip any HTML tags from message content
    for (const msg of messages) {
      msg.content = msg.content.replace(/<[^>]*>/g, '');
    }

    // ── 2. Authenticate (real auth or demo mode) ─────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let profile: Profile & { organization?: any };
    let membership: ProjectMember;
    let userId: string;
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
    const isDemoMode = isDemo === true && !!demoUserId;

    if (isDemoMode) {
      // Demo mode: load profile and membership from seed data
      const demoProfile = getSeedProfileWithOrg(demoUserId!);
      if (!demoProfile) {
        return new Response(JSON.stringify({ error: 'Demo profile not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const demoMembership = seedProjectMembers.find(
        (m) => m.project_id === projectId && m.profile_id === demoUserId,
      );

      profile = { ...demoProfile };
      membership = demoMembership ?? {
        id: 'demo-admin',
        project_id: projectId,
        profile_id: demoUserId!,
        project_role: 'manager' as const,
        can_edit: true,
        added_at: new Date().toISOString(),
      };
      userId = demoUserId!;
    } else {
      // Real auth: use Supabase session
      supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      userId = user.id;

      const [profileResult, membershipResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, organization:organizations(*)')
          .eq('id', user.id)
          .single(),
        supabase
          .from('project_members')
          .select('*')
          .eq('project_id', projectId)
          .eq('profile_id', user.id)
          .single(),
      ]);

      if (profileResult.error || !profileResult.data) {
        return new Response(JSON.stringify({ error: 'Profile not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Allow admins who are not explicit members
      let mem: ProjectMember | null = membershipResult.data;
      if (!mem) {
        if (profileResult.data.role === 'admin') {
          mem = {
            id: 'admin',
            project_id: projectId,
            profile_id: user.id,
            project_role: 'manager' as const,
            can_edit: true,
            added_at: new Date().toISOString(),
          };
        } else {
          return new Response(
            JSON.stringify({ error: 'Not a member of this project' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          );
        }
      }

      profile = profileResult.data as Profile & { organization?: any };
      membership = mem as ProjectMember;
    }

    const projectRole = membership.project_role;
    const permissions = getAllowedActions(projectRole);
    const canViewBudget = canPerform(projectRole, ACTIONS.BUDGET_VIEW);

    // ── 3. Pre-fetch project snapshot & build system prompt ──────────
    let projectSummary: ProjectSummary | undefined;
    let projectName: string | undefined;
    let projectLocation: string | undefined;

    if (isDemoMode) {
      projectSummary = getDemoProjectSummary(projectId, canViewBudget);
      if (seedProject.id === projectId) {
        projectName = seedProject.name;
        projectLocation = seedProject.location;
      }
    } else if (supabase) {
      try {
        const [summaryResult, projectResult] = await Promise.all([
          getSupabaseProjectSummary(supabase, projectId, canViewBudget),
          supabase
            .from('projects')
            .select('name, location')
            .eq('id', projectId)
            .single(),
        ]);
        projectSummary = summaryResult;
        if (projectResult.data) {
          projectName = projectResult.data.name;
          projectLocation = projectResult.data.location;
        }
      } catch {
        // If snapshot fetch fails, proceed without it
      }
    }

    const systemPrompt = buildSystemPrompt({
      profile,
      membership,
      permissions,
      projectId,
      projectSummary,
      projectName,
      projectLocation,
    });

    // ── 5. Select model ───────────────────────────────────────────────
    const model = selectModel(messages);

    // ── 5b. Conversation persistence (real auth only) ────────────────
    let conversationId: string | null = incomingConversationId ?? null;
    const isFirstMessage = !conversationId && !isDemoMode && supabase;

    if (isFirstMessage && supabase) {
      // Create a new conversation
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          project_id: projectId,
          user_id: userId,
          title: 'New Chat',
          model,
          message_count: 0,
        })
        .select()
        .single();

      if (!convErr && conv) {
        conversationId = conv.id;
      }
    }

    // ── 6. Prepare messages for OpenAI ────────────────────────────────
    // Trim to last 20 messages to manage context window
    const MAX_CONTEXT_MESSAGES = 20;
    const trimmedMessages = messages.length > MAX_CONTEXT_MESSAGES
      ? messages.slice(-MAX_CONTEXT_MESSAGES)
      : messages;

    const openaiMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...trimmedMessages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'tool' as const,
            content: m.content,
            tool_call_id: m.tool_call_id ?? '',
          };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          return {
            role: 'assistant' as const,
            content: m.content ?? null,
            tool_calls: m.tool_calls,
          };
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      }),
    ];

    // ── 7. Stream response with tool-call loop ────────────────────────
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (chunk: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        };

        try {
          // Send conversation ID to client so it can track the conversation
          if (conversationId) {
            send({ type: 'conversation', conversationId });
          }

          // Grab the latest user message for persistence
          const lastUserMessage = messages[messages.length - 1];

          // Helper: persist messages to Supabase (real auth only)
          const persistMessages = async (finalAssistantContent: string, finalToolCalls?: typeof toolCallsForPersistence) => {
            if (isDemoMode || !supabase || !conversationId) return;
            try {
              const messagesToInsert = [];

              // Persist the user message
              if (lastUserMessage) {
                messagesToInsert.push({
                  conversation_id: conversationId,
                  role: lastUserMessage.role,
                  content: lastUserMessage.content,
                  model: null,
                  tokens_used: null,
                });
              }

              // Persist the assistant response
              messagesToInsert.push({
                conversation_id: conversationId,
                role: 'assistant',
                content: finalAssistantContent,
                tool_calls: finalToolCalls && finalToolCalls.length > 0 ? finalToolCalls : null,
                model,
                tokens_used: null,
              });

              await supabase.from('messages').insert(messagesToInsert);

              // Update conversation message count and timestamp
              const countResult = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', conversationId);

              const updates: Record<string, unknown> = {
                updated_at: new Date().toISOString(),
                message_count: countResult.count ?? 0,
                model,
              };

              // Auto-title: if this is the first exchange, generate a title from the user message
              if (isFirstMessage && lastUserMessage) {
                const rawTitle = lastUserMessage.content.trim();
                const title = rawTitle.length > 50
                  ? rawTitle.substring(0, 47) + '...'
                  : rawTitle;
                updates.title = title;
              }

              await supabase
                .from('conversations')
                .update(updates)
                .eq('id', conversationId);
            } catch (e) {
              console.error('[RailBot] Failed to persist messages:', e);
            }
          };

          let currentMessages = [...openaiMessages];
          let toolRounds = 0;
          // Track all tool calls across rounds for persistence
          let toolCallsForPersistence: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = [];

          while (toolRounds <= MAX_TOOL_ROUNDS) {
            const completion = await openai.chat.completions.create({
              model,
              messages: currentMessages,
              tools: filterToolsForRole(projectRole),
              stream: true,
            });

            let assistantContent = '';
            let toolCalls: {
              id: string;
              function: { name: string; arguments: string };
            }[] = [];

            // Accumulate tool call argument chunks by index
            const toolCallAccumulator: Record<
              number,
              { id: string; function: { name: string; arguments: string } }
            > = {};

            for await (const chunk of completion) {
              const delta = chunk.choices[0]?.delta;
              const finishReason = chunk.choices[0]?.finish_reason;

              // Stream text content
              if (delta?.content) {
                assistantContent += delta.content;
                send({ type: 'text', content: delta.content });
              }

              // Accumulate tool calls
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index;
                  if (!toolCallAccumulator[idx]) {
                    toolCallAccumulator[idx] = {
                      id: tc.id ?? '',
                      function: { name: tc.function?.name ?? '', arguments: '' },
                    };
                  }
                  if (tc.id) toolCallAccumulator[idx].id = tc.id;
                  if (tc.function?.name)
                    toolCallAccumulator[idx].function.name = tc.function.name;
                  if (tc.function?.arguments)
                    toolCallAccumulator[idx].function.arguments +=
                      tc.function.arguments;
                }
              }

              if (finishReason === 'stop') {
                // Model is done, no tool calls — persist and close
                await persistMessages(assistantContent, toolCallsForPersistence);
                send({ type: 'done' });
                controller.close();
                return;
              }

              if (finishReason === 'tool_calls') {
                // Collect accumulated tool calls
                toolCalls = Object.values(toolCallAccumulator);
              }
            }

            // If no tool calls, we are done
            if (toolCalls.length === 0) {
              await persistMessages(assistantContent, toolCallsForPersistence);
              send({ type: 'done' });
              controller.close();
              return;
            }

            // ── Execute tool calls ──────────────────────────────────
            toolRounds++;

            // Track for persistence
            toolCallsForPersistence.push(
              ...toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: tc.function,
              })),
            );

            // Add assistant message with tool calls to history
            currentMessages.push({
              role: 'assistant',
              content: assistantContent || null,
              tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: tc.function,
              })),
            });

            // Execute each tool call and add results
            for (const tc of toolCalls) {
              send({
                type: 'tool_call',
                toolCall: {
                  id: tc.id,
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              });

              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = JSON.parse(tc.function.arguments);
              } catch {
                // If argument parsing fails, pass empty object
              }

              const result = isDemoMode
                ? await executeDemoTool(
                    tc.function.name,
                    parsedArgs,
                    projectRole,
                    projectId,
                    userId,
                  )
                : await executeTool(
                    tc.function.name,
                    parsedArgs,
                    projectRole,
                    projectId,
                    userId,
                    supabase!,
                  );

              const resultString = JSON.stringify(result);

              send({
                type: 'tool_result',
                toolResult: { id: tc.id, result: resultString },
              });

              currentMessages.push({
                role: 'tool' as const,
                content: resultString,
                tool_call_id: tc.id,
              });
            }

            // Loop back to let the model process tool results
          }

          // If we exit the loop, we hit the max rounds
          send({
            type: 'error',
            error: 'Maximum tool call rounds reached. Please simplify your request.',
          });
          send({ type: 'done' });
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'An unexpected error occurred';
          send({ type: 'error', error: message });
          send({ type: 'done' });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[RailBot API Error]', err);
    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request. Please try again.',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
