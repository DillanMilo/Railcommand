import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const RAILBOT_TOOLS: ChatCompletionTool[] = [
  // ── Read Tools ──────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'search_submittals',
      description:
        'Search submittals in the current project. Use for questions like: "What submittals are overdue?", "Show me pending submittals", "Find submittals about track construction", "How many approved submittals do we have?", "Are there any rejected submittals?". Returns matching submittals with number, title, status, spec section, and dates.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'submitted', 'under_review', 'approved', 'conditional', 'rejected'],
            description: 'Filter by submittal status',
          },
          search: {
            type: 'string',
            description: 'Search by title or spec section (partial match)',
          },
          due_before: {
            type: 'string',
            description: 'Filter submittals due before this date (ISO 8601)',
          },
          due_after: {
            type: 'string',
            description: 'Filter submittals due after this date (ISO 8601)',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_rfis',
      description:
        'Search RFIs (Requests for Information) in the current project. Use for questions like: "What RFIs are open?", "Show me critical RFIs", "Are there any overdue RFIs?", "Find RFIs about signal timing", "How many unanswered RFIs do we have?". Returns matching RFIs with number, subject, status, priority, and dates.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'answered', 'closed', 'overdue'],
            description: 'Filter by RFI status',
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'Filter by priority',
          },
          search: {
            type: 'string',
            description: 'Search by subject (partial match)',
          },
          due_before: {
            type: 'string',
            description: 'Filter RFIs due before this date (ISO 8601)',
          },
          due_after: {
            type: 'string',
            description: 'Filter RFIs due after this date (ISO 8601)',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_punch_list',
      description:
        'Search punch list items in the current project. Use for questions like: "What punch list items are open?", "Show me critical punch items", "What issues are at Siding 2?", "Are there unresolved punch items?", "What is assigned to Bobby?". Returns matching items with number, title, status, priority, location, and assignee.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'in_progress', 'resolved', 'verified'],
            description: 'Filter by punch list status',
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'Filter by priority',
          },
          search: {
            type: 'string',
            description: 'Search by title or location (partial match)',
          },
          assigned_to: {
            type: 'string',
            description: 'Filter by assigned user ID',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_daily_logs',
      description:
        'Search daily logs in the current project. Use for questions like: "What work was done today?", "Show me logs from last week", "What happened on February 15th?", "Find logs mentioning ballast work", "What were the weather conditions this week?". Returns matching logs with date, weather, work summary, and author.',
      parameters: {
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            description: 'Filter logs from this date (ISO 8601)',
          },
          date_to: {
            type: 'string',
            description: 'Filter logs up to this date (ISO 8601)',
          },
          search: {
            type: 'string',
            description: 'Search by work summary (partial match)',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_summary',
      description:
        'Get a high-level summary of the current project including counts of submittals, RFIs, punch list items, milestones, and overdue items. Use for questions like: "Give me a project overview", "How is the project doing?", "What is the current status?", "How many items do we have?".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_overdue_items',
      description:
        'Get all overdue items across submittals, RFIs, and punch list items in the current project. Use for questions like: "What is overdue?", "Are there any late items?", "What needs immediate attention?", "Show me everything past due".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_budget_summary',
      description:
        'Get the budget summary for the current project including total budget, spent, remaining, and per-milestone breakdown. Requires budget:view permission. Use for questions like: "What is the budget status?", "How much have we spent?", "Are we over budget?", "Show me budget by milestone".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_team_members',
      description:
        'List all project team members with their roles and contact info. Use for questions like: "Who is on the team?", "Who is the engineer?", "Show me all contractors", "Who is the project manager?", "List team members".',
      parameters: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            description: 'Optional filter by project role (e.g., manager, engineer, foreman, contractor, inspector, superintendent)',
          },
          search: {
            type: 'string',
            description: 'Search team members by name (partial match)',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_milestones',
      description:
        'Search milestones by status in the current project. Use for questions like: "What milestones are behind?", "Show me upcoming milestones", "Are any milestones at risk?", "What milestones are complete?", "How is the schedule looking?".',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['on_track', 'at_risk', 'behind', 'complete', 'not_started'],
            description: 'Filter milestones by status',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_activity',
      description:
        'Get recent activity log entries for the current project. Use for questions like: "What happened today?", "Show recent changes", "What activity has there been this week?", "What was updated recently?", "Show me the latest submittal activity".',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of entries to return (default 20)',
          },
          entity_type: {
            type: 'string',
            enum: ['submittal', 'rfi', 'daily_log', 'punch_list', 'milestone'],
            description: 'Filter by entity type',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_daily_log_rollup',
      description:
        'Get a rollup of daily logs for a date range — aggregates work summaries, total personnel headcounts, equipment usage, and weather across multiple days. Use for questions like: "Summarize this week\'s work", "What did we do last month?", "Give me a weekly progress report", "Summarize daily logs from March".',
      parameters: {
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            description: 'Start date for rollup (ISO 8601). Defaults to 7 days ago.',
          },
          date_to: {
            type: 'string',
            description: 'End date for rollup (ISO 8601). Defaults to today.',
          },
          period: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
            description: 'Rollup period. Defaults to weekly.',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },

  // ── Write Tools ─────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_rfi',
      description:
        'Create a new RFI in the current project. Requires rfi:create permission. CRITICAL: You must show the user a summary of what will be created and get explicit confirmation BEFORE calling this function. If any required field is unclear, ask the user first. Understands informal crew language like "log an RFI about..." or "need to ask about..." — parse the user intent into structured fields.',
      parameters: {
        type: 'object',
        properties: {
          subject: {
            type: 'string',
            description: 'The subject / title of the RFI',
          },
          question: {
            type: 'string',
            description: 'The detailed question being asked',
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'Priority level (defaults to medium)',
          },
          assigned_to: {
            type: 'string',
            description: 'User ID to assign the RFI to',
          },
          due_date: {
            type: 'string',
            description: 'Due date for the RFI response (ISO 8601)',
          },
        },
        required: ['subject', 'question'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_punch_list_item',
      description:
        'Create a new punch list item in the current project. Requires punch_list:create permission. CRITICAL: You must show the user a summary of what will be created and get explicit confirmation BEFORE calling this function. If any required field is unclear, ask the user first. Understands informal crew language like "punch list that...", "add a punch item for...", "flag the issue with..." — parse into structured fields.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of the punch list item',
          },
          description: {
            type: 'string',
            description: 'Detailed description of the issue',
          },
          location: {
            type: 'string',
            description: 'Location where the issue was found',
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'Priority level (defaults to medium)',
          },
          assigned_to: {
            type: 'string',
            description: 'User ID to assign the item to',
          },
          due_date: {
            type: 'string',
            description: 'Due date for resolution (ISO 8601)',
          },
        },
        required: ['title', 'description', 'location'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_daily_log',
      description:
        'Create a new daily log entry in the current project. Requires daily_log:create permission. CRITICAL: You must show the user a summary of what will be created and get explicit confirmation BEFORE calling this function. If any required field is unclear, ask the user first. Understands informal crew language like "log today...", "daily report: ..." — parse weather, work summary, and other details from natural speech.',
      parameters: {
        type: 'object',
        properties: {
          log_date: {
            type: 'string',
            description: 'The date for this log entry (ISO 8601). Defaults to today.',
          },
          weather_temp: {
            type: 'number',
            description: 'Temperature in degrees Fahrenheit',
          },
          weather_conditions: {
            type: 'string',
            description: 'Weather conditions (e.g., "Sunny", "Rain", "Overcast")',
          },
          weather_wind: {
            type: 'string',
            description: 'Wind conditions (e.g., "Calm", "10-15 mph SW")',
          },
          work_summary: {
            type: 'string',
            description: 'Summary of work performed',
          },
          safety_notes: {
            type: 'string',
            description: 'Any safety observations or incidents',
          },
        },
        required: ['work_summary'],
        additionalProperties: false,
      },
    },
  },
];
