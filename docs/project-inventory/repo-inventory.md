# Flow Repository Inventory

Inventory date: 2026-05-04

Source repositories:

- InvoFlow: https://github.com/DillanMilo/CCINV.git
- VibeFlow: https://github.com/DillanMilo/vibeflow.git
- LeadFlow: https://github.com/DillanMilo/Leadflow.git
- AssetFlow: https://github.com/DillanMilo/AssetFlow.git

## Summary

The current central app should remain the command shell. It is already Next.js 16, Supabase-backed, and has an OpenAI tool-calling assistant pattern. The four source apps split into two migration groups:

- Direct Supabase/database migrations: InvoFlow, VibeFlow, AssetFlow
- External API-heavy workflow migration: LeadFlow, AssetFlow

AssetFlow belongs to both groups because it has a Supabase schema plus multiple market/news/AI API integrations.

## InvoFlow

Repository: `CCINV`

Stack:

- Next.js 13.5 app router
- React 18
- Supabase auth/helpers and Supabase JS
- OpenAI direct REST calls
- Google APIs package
- Tailwind 3 and shadcn/Radix UI

Primary routes:

- `/`
- `/clients`
- `/expenses`
- `/fixed-expenses`
- `/income`
- `/invoices`
- `/invoices/new`
- `/invoices/[id]`
- `/profile`
- `/backup`
- `/login`

API routes:

- `/api/chat`
- `/api/transcribe`
- `/api/expense`
- `/api/income`
- `/api/clear-data`
- invoice PDF/export/debug routes are also present deeper in `app/api`

Data model:

- `AppData` JSON payload containing expenses, income, invoices, fixed expenses, clients, profile, settings, and last sync
- Supabase table `app_data`
- Current simple schema stores the app state as JSONB
- Multi-user migration files exist and should be reviewed before adopting the storage model

Environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SYNC_KEY` legacy/simple sync
- `OPENAI_API_KEY`

Migration notes:

- Best first financial module to migrate because its domain is clear and operationally valuable.
- Do not preserve the single JSONB `app_data` structure long term unless speed is the only goal.
- Recommended central tables: `invoice_clients`, `invoices`, `invoice_line_items`, `expenses`, `income_entries`, `fixed_expenses`, `business_profiles`.
- Reuse the current central app's OpenAI package rather than copying direct REST chat code.
- Invoice PDF routes are worth porting after core invoice CRUD works.

## VibeFlow

Repository: `vibeflow`

Stack:

- Next.js 16.1 app router
- React 19
- Supabase SSR and Supabase JS
- Tailwind 4

Primary routes:

- `/`
- `/login`
- `/signup`

Data model:

- `profiles`
- `projects`
- `kanban_cards`
- `todo_items`
- project-level `todo_categories`
- card/todo `category_id`
- local app types also include calendar events and activity entries

Environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for Google Calendar sync

Migration notes:

- VibeFlow is the closest technical match to the current central app because both are modern Next.js/Supabase.
- Its Supabase schema can be adapted into central tables with prefixed names: `vibe_projects`, `vibe_kanban_cards`, `vibe_todo_items`, `vibe_calendar_events`, `vibe_activity_entries`.
- Keep VibeFlow project IDs separate from the central app's existing `projects` table unless the central product concept changes from construction projects to generic workspaces.
- Google Calendar sync should be a phase-two integration after core project/task migration.

## LeadFlow

Repository: `Leadflow`

Stack:

- Vite 6
- React 19
- Firebase auth and Firestore
- Vercel Node API functions
- Gemini via `@google/genai`
- Google Places/PageSpeed APIs
- Axios and Cheerio scraping endpoints

Primary UI modules:

- Dashboard
- ICP form
- Scraper form
- Lead list
- Lead details
- Saved leads
- Follow-up list
- Outreach history
- Touched leads

API routes/functions:

- `/api/health`
- `/api/enrich`
- `/api/audit`
- `/api/scrape-emails`
- `/api/verify-urls`

Data model:

- Firestore `leads`
- Firestore `users` with ICP settings
- Lead fields include niche, area, website, email, phone, socials, contacts, SEO/performance/design/CRO/mobile scores, status, temperature, tags, engagement, follow-up fields, Google Places enrichment, and owner ID.

Environment variables:

- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_FIRESTORE_DATABASE_ID`

Migration notes:

- LeadFlow should not be iframe-wrapped. Its value is in server-side enrichment, scraping, audit scoring, and CRM data.
- Move Firebase data to Supabase unless there is a strong reason to keep Firestore.
- Recommended central tables: `leads`, `lead_contacts`, `lead_engagements`, `lead_audits`, `lead_enrichments`, `lead_icp_profiles`, `lead_scrape_jobs`.
- Convert Vercel functions into Next.js route handlers under the central app.
- Keep `GOOGLE_API_KEY` and `GEMINI_API_KEY` server-only. Current Vite-style client env handling should not be copied into the central frontend.

## AssetFlow

Repository: `AssetFlow`

Stack:

- Vite 6
- React 19
- Supabase JS
- Supabase schema and migrations
- Multiple market/news/AI service integrations

Primary UI modules:

- Dashboard
- Asset manager
- Markets
- News view
- Journal
- Cipher AI assistant
- Settings
- Login page

Data model:

- `profiles`
- `assets`
- `transactions`
- `journal_entries`
- `trading_funds`
- `portfolio_wallets`
- cached price and AI bot migrations are present

Environment variables and integrations:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `XAI_API_KEY`
- `VITE_COINGECKO_API_KEY`
- `VITE_COINMARKETCAP_API_KEY`
- `VITE_FINNHUB_API_KEY`
- `VITE_METALS_DEV_API_KEY`
- `VITE_CRYPTOPANIC_API_KEY`
- `VITE_ALPHA_VANTAGE_API_KEY`

Migration notes:

- AssetFlow has the most sensitive API-key posture because its Vite config maps several env vars into frontend bundles.
- In the central app, market/news/AI calls should move behind server routes or server actions.
- Recommended central tables: `asset_holdings`, `asset_transactions`, `asset_journal_entries`, `asset_trading_funds`, `asset_portfolio_wallets`, `asset_cached_prices`.
- AssetFlow can provide immediate dashboard value through read-only portfolio totals before full trading journal migration.
- Its AI assistant should be folded into the central command assistant as asset-specific tools.

## Recommended Migration Order

1. Central shell navigation and neutral branding
2. InvoFlow read-only dashboard cards
3. InvoFlow normalized invoice/client/expense migration
4. LeadFlow server API endpoints and lead dashboard
5. LeadFlow Firestore-to-Supabase data migration
6. AssetFlow read-only portfolio and market cards
7. AssetFlow server-side market/news API wrappers
8. VibeFlow project/task/calendar migration
9. Unified AI command center across all flows

## Immediate Build Tasks

1. Add central nav entries for Invoices, Leads, Assets, and Vibe.
2. Create placeholder dashboard pages for each flow in the current Next.js app.
3. Add `src/lib/flows/*/types.ts` files with the core domain types.
4. Add a command dashboard data contract that each flow can satisfy.
5. Start with InvoFlow because its data model and user workflows are the most straightforward.
