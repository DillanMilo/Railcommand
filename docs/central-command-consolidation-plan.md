# Central Command Consolidation Plan

This plan is for combining `vibe flow`, `asset flow`, `invoice flow`, and `lead flow` into one central command application.

Source repository inventory is captured in [repo-inventory.md](./project-inventory/repo-inventory.md).

## Current Workspace Baseline

The current app is already a good shell for the combined product:

- Next.js app router frontend and API routes
- Supabase client/server/admin helpers
- OpenAI dependency and AI chat route
- Resend email integration
- Role/permission patterns
- Sidebar/topbar/mobile navigation
- Tool-based AI assistant structure in `src/lib/railbot`

The four source projects have been inspected from GitHub:

- InvoFlow: `https://github.com/DillanMilo/CCINV.git`
- VibeFlow: `https://github.com/DillanMilo/vibeflow.git`
- LeadFlow: `https://github.com/DillanMilo/Leadflow.git`
- AssetFlow: `https://github.com/DillanMilo/AssetFlow.git`

## Target Shape

The combined app should become a single operations cockpit with four product areas:

- Vibe Flow: projects, kanban cards, todos, calendar events, activity
- Asset Flow: portfolio holdings, transactions, markets, news, trade journal, AI insights
- Invoice Flow: clients, invoices, invoice line items, expenses, income, fixed expenses, profile
- Lead Flow: lead scraping, enrichment, website audits, CRM pipeline, follow-up automation

Recommended top-level navigation:

- Command Dashboard
- Vibe
- Assets
- Invoices
- Leads
- AI Command Center
- Settings

## Backend Strategy

Use the current Next.js app as the primary shell and API gateway. Do not merge every backend blindly into one database on day one.

Recommended pattern:

1. Keep each existing backend running until its data model and workflows are understood.
2. Add adapter modules inside the central app for each product.
3. Move shared concepts first: users, organizations, permissions, files, notifications, and audit/activity logs.
4. Migrate domain data one flow at a time.
5. Retire the old backend only after the equivalent central workflow is tested.

Suggested adapter layout:

```txt
src/lib/flows/
  vibe/
    client.ts
    actions.ts
    types.ts
    tools.ts
  assets/
    client.ts
    actions.ts
    types.ts
    tools.ts
  invoices/
    client.ts
    actions.ts
    types.ts
    tools.ts
  leads/
    client.ts
    actions.ts
    types.ts
    tools.ts
```

## API Key Strategy

Keep every external API key server-only. The central app should expose internal server actions or API routes, never client-side keys.

Recommended environment names:

```txt
OPENAI_API_KEY=
RESEND_API_KEY=
GOOGLE_API_KEY=
GEMINI_API_KEY=
XAI_API_KEY=
COINGECKO_API_KEY=
COINMARKETCAP_API_KEY=
FINNHUB_API_KEY=
METALS_DEV_API_KEY=
CRYPTOPANIC_API_KEY=
ALPHA_VANTAGE_API_KEY=
```

Do not copy Vite-style public market/AI keys into the combined frontend. In the central app, all LeadFlow and AssetFlow enrichment, market, news, and AI calls should go through server routes or server actions.

## AI Strategy

The current `railbot` structure can become a generalized command assistant.

Recommended rename path:

- `src/lib/railbot` -> `src/lib/command-ai`
- `RailBotPanel` -> `CommandPanel`
- `RAILBOT_TOOLS` -> `COMMAND_TOOLS`
- Flow-specific tools live in each flow module and are composed into one tool registry.

The AI assistant should know:

- Which flow the user is currently viewing
- Which organization/workspace the user belongs to
- What actions the user is allowed to take
- Which tools are read-only versus write-capable
- When an action needs confirmation before execution

High-value AI commands:

- "Show everything that needs attention today."
- "Summarize open invoices and overdue leads."
- "Find assets related to this client."
- "Create a follow-up task from this lead."
- "Draft an invoice email."
- "Generate a campaign from these assets."

## Data Model Unification

Shared tables/entities should be centralized:

- organizations
- profiles/users
- memberships/roles
- files/assets
- comments/notes
- notifications
- activity logs
- AI conversations
- integrations

Domain tables can stay separate by flow:

- `vibe_projects`, `vibe_kanban_cards`, `vibe_todo_items`, `vibe_calendar_events`, `vibe_activity_entries`
- `asset_holdings`, `asset_transactions`, `asset_journal_entries`, `asset_trading_funds`, `asset_portfolio_wallets`, `asset_cached_prices`
- `invoice_clients`, `invoices`, `invoice_line_items`, `expenses`, `income_entries`, `fixed_expenses`, `business_profiles`
- `leads`, `lead_contacts`, `lead_engagements`, `lead_audits`, `lead_enrichments`, `lead_icp_profiles`, `lead_scrape_jobs`

Avoid one overloaded `items` table unless the four apps already share nearly identical data.

## Migration Phases

### Phase 1: Inventory

Completed from the provided GitHub repositories. See [repo-inventory.md](./project-inventory/repo-inventory.md).

### Phase 2: Central Shell

In this repo:

- Add flow navigation
- Add placeholder dashboard pages for the four flows
- Define shared types for flow status cards and cross-flow activity
- Create a central command dashboard with key metrics from each flow

### Phase 3: Backend Adapters

For the projects with backends/data stores:

- Create server-only clients
- Add health-check endpoints
- Add read-only summary calls first
- Surface summary data on the command dashboard

Classified from inventory:

- InvoFlow: Supabase, currently stores app state in `app_data` JSONB
- VibeFlow: Supabase, normalized projects/cards/todos schema
- LeadFlow: Firebase auth and Firestore, plus Vercel API functions
- AssetFlow: Supabase, normalized portfolio/journal schema

### Phase 4: API-Key Integrations

For the API-key-heavy flows:

- Move credentials to `.env.local`
- Add server-only wrappers
- Add typed request/response validation
- Add rate-limit and error handling
- Add AI tools only after direct calls work

Classified from inventory:

- LeadFlow: `GEMINI_API_KEY`, `GOOGLE_API_KEY`, Firebase public config
- AssetFlow: `XAI_API_KEY`, CoinGecko, CoinMarketCap, Finnhub, Metals.dev, CryptoPanic, Alpha Vantage
- InvoFlow: `OPENAI_API_KEY` for chat/transcription
- VibeFlow: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for calendar sync

### Phase 5: AI Command Center

- Generalize the current AI assistant
- Add flow-specific tool registries
- Add permission filtering for tools
- Add confirmation gates for write actions
- Log tool calls and AI actions

### Phase 6: Full Migration

Migrate one product at a time:

1. Invoice Flow
2. Lead Flow
3. Asset Flow
4. Vibe Flow

This order is recommended because InvoFlow has the clearest domain model and can quickly validate the central command shell. LeadFlow follows because its server endpoints and CRM data produce high dashboard value. AssetFlow has more API-key and market-data risk, and VibeFlow is technically straightforward but less urgent for central operations.

## Immediate Next Steps

1. Keep the current Next.js/Supabase app as the central shell.
2. Add placeholder routes and navigation for Invoices, Leads, Assets, and Vibe.
3. Add `src/lib/flows/*/types.ts` domain contracts.
4. Start InvoFlow migration with read-only dashboard cards.
5. Normalize InvoFlow data instead of permanently copying the single JSONB `app_data` model.

## Open Questions

- Do all four projects use the same auth/users?
- Is Supabase the desired long-term database for the combined app?
- Should the combined product keep the current RailCommand branding or become a new brand?
- Are these flows for one internal team, or will multiple client organizations use them?
- Should Firebase remain for LeadFlow temporarily, or should LeadFlow be migrated to Supabase immediately?
