# RAILCOMMAND — MVP Project Reference
*(Living document — check off items as completed)*

---

## Build Order (Phase-by-Phase)

### Phase 1: Foundation
- [x] Initialize Next.js 14 project with TypeScript
- [x] Install and configure Tailwind CSS + ShadCN/UI
- [x] Add Google Fonts (Plus Jakarta Sans, DM Sans, JetBrains Mono)
- [x] Set up CSS variables for color palette
- [x] Create root layout with font loading
- [x] Set up Supabase project + environment variables
- [x] Build type definitions (`types.ts`)

### Phase 2: App Shell & Navigation
- [x] Build Sidebar component (desktop — collapsible)
- [x] Build Topbar component (search, notifications bell, user avatar)
- [x] Build MobileNav (bottom tab bar for mobile)
- [x] Build Breadcrumbs component
- [x] Create app layout with responsive breakpoints
- [x] Login page (simple — email/password with Supabase Auth)

### Phase 3: Seed Data
- [x] Create comprehensive seed data file with realistic railroad project data
- [x] Build custom hooks for data access
- [x] Set up data fetching patterns

### Phase 4: Dashboard
- [x] Project overview dashboard with KPI cards
- [x] Recent activity feed
- [x] Quick action buttons
- [x] Upcoming milestones widget
- [x] Budget health summary
- [x] Responsive layout (cards on mobile, richer on desktop)

### Phase 5: Submittals Module
- [x] Submittals list page with status filters
- [x] Submittal detail page with timeline and audit trail
- [x] Create submittal form
- [x] Approve/Reject workflow (engineer view)
- [x] Aging indicators (days overdue)

### Phase 6: RFIs Module
- [x] RFI list page with status filters
- [x] RFI detail page with question/response thread
- [x] Create RFI form
- [x] Overdue highlighting
- [x] Linked documents display

### Phase 7: Daily Logs Module
- [x] Calendar view
- [x] Create daily log form (personnel, equipment, work items, photos, weather)
- [x] Daily log detail view
- [x] Structured data entry (headcount tables, equipment lists)

### Phase 8: Punch Lists Module
- [x] Punch list view with filters (status, priority, assignee)
- [x] Create punch list item form
- [x] Punch list detail with resolution workflow
- [x] Photo attachment support

### Phase 9: Schedule & Milestones
- [x] Milestone list with status indicators
- [x] Simplified timeline view
- [x] Budget tracking per milestone
- [x] Linked submittals/RFIs display
- [x] Overall schedule health KPIs

### Phase 10: Polish & Demo Readiness
- [x] Loading states and skeleton screens
- [x] Empty states with helpful messaging
- [x] Error handling and error boundaries
- [x] Mobile responsiveness audit (every page)
- [x] Touch target sizing audit (44px minimum)
- [x] Color contrast accessibility check
- [x] Page transitions / micro-animations
- [x] Favicon and meta tags
- [x] Deploy to Vercel

### Phase 10.5: PDF Report Export
- [x] Install @react-pdf/renderer for client-side PDF generation
- [x] Create shared PDF styles and branding (RailCommand / A5 Rail)
- [x] Build Submittals PDF report template
- [x] Build RFIs PDF report template
- [x] Build Daily Log PDF report template
- [x] Build Punch List PDF report template
- [x] Build Schedule & Milestones PDF report template
- [x] Create reusable ExportPDFButton component
- [x] Wire up Export PDF buttons on Submittals, RFIs, Punch List, Schedule, and Daily Log detail pages

### Phase 10.6: Beta-Blocking Features
- [x] PWA Manifest & App Icons (manifest.json, service worker, installable app)
- [x] Cross-Module Global Search (Cmd+K command palette, searches all modules)
- [x] File & Document Storage (Supabase Storage integration, drag & drop FileUpload component)
- [x] Email Notifications (Resend integration, 8 notification types, Vercel Cron for overdue digests + daily log reminders, team update triggers, custom SMTP for Supabase Auth, preferences UI with 8 toggles)

### Phase 11: AI Assistant (RailBot) 🤖
**Architecture & Design** *(Week 3)*
- [x] Design RailBot architecture (OpenAI API + Supabase data layer)
- [x] Define system prompt with RBAC-scoped context injection
- [x] Define OpenAI function calling schemas (mapped to existing server actions)
- [x] Design conversation state management (Supabase tables + React state)
- [x] Create railbot.md architecture document

**Backend** *(Week 3–4)*
- [x] Set up OpenAI API integration (openai SDK + `/api/chat` route)
- [x] Implement streaming responses (Server-Sent Events)
- [x] Build RBAC-scoped context builder (dynamic system prompt per user role)
- [x] Implement function calling handlers (search submittals, RFIs, punch list, daily logs)
- [x] Add read-only query functions (project summary, overdue items, budget summary)
- [x] Add write operation functions with confirmation flow (create RFI, punch item, daily log)
- [x] Create conversation & message Supabase tables with RLS policies
- [x] Build conversation persistence (save/load/list conversations)
- [x] Error handling for API calls (status-specific errors, input validation, HTML stripping)

**Frontend** *(Week 4)*
- [x] Build slide-over chat panel component (slides from right, any page)
- [x] Build message bubbles (user/assistant), typing indicator, streaming text display
- [x] Build message input with send button + Enter shortcut
- [x] Build conversation history sidebar (past conversations list)
- [x] Mobile-optimized chat experience (safe area padding, responsive bubbles, keyboard scroll, compact header)
- [x] Add RailBot trigger button (floating action button or sidebar icon)

**Voice & Audio** *(Week 4)*
- [x] Voice dictation via OpenAI Whisper API (`/api/chat/transcribe` route)
- [x] Microphone recording with soundwave animation
- [x] Auto-transcription to chat input

**Conversational Data Entry** *(Week 4)*
- [x] Conversational RFI creation flow (parse crew language into structured fields)
- [x] Conversational punch list creation flow (informal input → structured data)
- [x] Conversational daily log creation flow
- [x] Confirmation step before all write operations (6-step protocol in system prompt)
- [x] Assignee resolution via team member name lookup
- [x] Crew language test suite (17 tests passing)

**Summarization** *(Week 4)*
- [x] Project summarization feature (get_project_summary tool with KPIs, overdue counts, budget)
- [x] Daily log auto-summaries — weekly/monthly rollups (get_daily_log_rollup tool)
- [x] "Summarize this week's work" suggested prompt

**Polish & Guardrails** *(Week 4)*
- [x] Guard rails — read-heavy by default, confirm before any create/update actions
- [x] Context window management (20-message sliding window)
- [x] Auto-title conversations from first message
- [x] Message timestamps on chat bubbles
- [x] "Thinking..." indicator during tool calls (bouncing dots animation)
- [x] Retry button on failed messages
- [x] Status-specific error messages (401, 403, 429, 502)
- [x] Input sanitization and security hardening (HTML stripping, message length limits, projectId validation, write tool argument validation)

### Alpha Bug Fixes (March 2026)
- [x] **BUG FIX: Calendar dates one day behind** — All date-only fields (due dates, log dates, target dates, etc.) were displaying one day behind what the user selected. Root cause: `new Date("YYYY-MM-DD")` interprets as UTC midnight, which shifts back one day in US timezones. Fix: Created `src/lib/date-utils.ts` with timezone-safe helpers (`getLocalDateString`, `getLocalDateStringOffset`, `formatDateSafe`, `parseDateSafe`). Replaced all `new Date(dateStr)` calls with `parseISO(dateStr)` from date-fns for display, and all `.toISOString().split('T')[0]` patterns with local timezone date string helpers. Fixed across all modules: dashboard, submittals, RFIs, daily logs, punch lists, schedule/milestones, and profile page.
- [x] **BUG FIX: Multiple photo uploads — only some photos persist** — When uploading 6+ photos, only 3-4 would actually appear after submission. Root cause: Photos were uploaded sequentially and failures were silently swallowed (only logged to console). Fix: Refactored `uploadPhotosAfterCreate` and `uploadFilesAfterCreate` to use `Promise.allSettled` for concurrent uploads, return structured results (success/fail counts), and report failures to the user. Updated all creation forms (daily logs, punch lists, RFIs, submittals) to show upload progress ("Uploading N photos…"), disable submit buttons during upload, and display error messages when uploads partially fail.

### Phase 12: V2 Sprint — Caleb Douglas Feedback (April–May 2026)

**Source:** Caleb Douglas beta feedback (16 items)
**Sprint Duration:** 4 weeks (April 13 – May 8, 2026)
**Launch Target:** May 11, 2026

#### Week 1: Dashboard & Core UX (April 13–17)
- [x] Clickable dashboard KPI boxes → navigate to detail pages with pre-filtering (?status= URL params)
- [ ] Recent activity entries tappable → item detail views
- [ ] Team listing moved to prominent position (not behind "More")
- [ ] Schedule box: Turnover Date, Substantial Completion Date, Project Completion Date fields
- [ ] CPI calculation (Earned Value / Actual Cost) with color-coded indicators
- [ ] SPI calculation (Earned Value / Planned Value) with color-coded indicators
- [ ] Project Documents dashboard box with revision tracking header
- [ ] PDF format enforcement for drawings + AutoCAD/MicroStation folder
- [ ] Daily logs calendar: full 7-day week view

#### Week 2: Reports, Change Management (April 20–24)
- [ ] Weekly Reports section (CM and Contractor)
- [ ] Safety module (own box or within daily logs, incident reporting)
- [ ] Change Orders in Budget box
- [ ] Modifications & Amendments in Plans section
- [ ] Demo data backfill (February through current date)
- [ ] Week 1-2 integration testing

#### Week 3: QC/QA & Photos (April 27 – May 1)
- [ ] QC/QA Reports module with nonconformance tracking
- [ ] QC/QA close-out workflow
- [ ] QC/QA → Punch List linking (bidirectional)
- [ ] QC/QA Plan per project (routable like submittals)
- [ ] Photos bin: mobile camera → auto-save to project folder
- [ ] Photo auto-organization by date folders
- [ ] Geo-tag and timestamp metadata capture

#### Week 4: Permissions, Polish & Launch (May 4–8)
- [ ] RBAC management UI (Read/Write/Create per team member)
- [ ] Full integration testing across all new features
- [ ] Desktop vs mobile UX parity check
- [ ] Demo data updated for all new features
- [ ] Pre-launch QA sweep
- [ ] Staging release candidate tag

#### Deferred to V2.5 (Post-Launch)
- [ ] Live camera integration (Z-P-T controls, photo logs, time-lapse)
- [ ] Weather auto-pull from online systems
- [ ] Contractor pay request documentation storage
- [ ] Meeting minutes / Project Administration folder
- [ ] SiteCast/OVRLAI integration (pending Mark's direction)

### Beta Roadmap

#### Week 1: PWA Install Experience
- [x] Enhance web app manifest with branded icons, maskable icons, shortcuts, and screenshots
- [x] Upgrade service worker with offline fallback page, update notifications, and improved caching
- [x] Build PWA install prompt hook (beforeinstallprompt capture, install/update triggers)
- [x] Wire up Installation Guide UI in Settings with platform-specific instructions (iOS Safari, Android Chrome, Desktop)
- [x] Add offline status detection and standalone mode detection
- [x] Test Add to Home Screen on iOS (Safari), Desktop (Chrome) — PASS. Android pending device access.
- [x] Verify native-like behavior when launched from home screen — standalone mode confirmed on iOS + Desktop
- [x] Deploy to Vercel for install testing — live at railcommand.vercel.app

#### Week 2: Global Search Upgrade ✅
- [x] Upgrade search backend to query across all modules (submittals, RFIs, punch items, daily logs, milestones)
- [x] Expand searchable fields: number, title, assignee, content (description, question/answer, work summary, safety notes, resolution notes)
- [x] Add assignee name search via profile join (two-phase: text fields + profile name lookup)
- [x] Add `matchField` and `assignee` metadata to search results for UI context
- [x] Upgrade GlobalSearch command palette UI with assignee display, match indicators, and per-module result counts
- [x] Build dedicated search results page (`/search?q=`) with module filter tabs, result cards, and responsive layout
- [x] Upgrade demo mode search to include assignee name matching
- [x] Refactor frontend to use single `global_search` RPC call (~2.6ms) instead of 9+ parallel queries
- [x] Add recent search history (localStorage, `useRecentSearches` hook) — shown in command palette and search page
- [x] Add keyboard shortcuts: `Cmd+Shift+F` (full search), `Cmd+Backspace` (clear), `Cmd+Enter` (all results), `Escape` (clear & blur), `1-6` (filter tabs), `/` (focus)
- [x] Edge case hardening: race condition fix (stale result discard via counter ref), 200-char query limit (server + client), rapid open/close safety
- [x] Mobile responsive: 44px touch targets, horizontal-scroll filter pills, bottom padding for mobile nav, touch press feedback, hidden keyboard hints on touch
- [x] **Supabase backend:** Created 7 GIN full-text search indexes on all module tables + profiles
- [x] **Supabase backend:** Created `global_search` RPC function for single-call search with `ts_rank` relevance scoring + ILIKE fallback
- [x] **Supabase backend:** Added RLS validation inside RPC (auth.uid() + project_members check)
- [x] **Supabase backend:** Added 6 B-tree indexes on `project_id` columns and `project_members.profile_id`
- [x] **Supabase backend:** Seeded 600+ records (120 per table) with realistic railroad construction data
- [x] **Supabase backend:** Created materialized `search_index` view (628 rows) with GIN + B-tree indexes for optional unified search
- [x] **Supabase backend:** Verified performance via `EXPLAIN ANALYZE` — materialized search executes in ~2.6ms using GIN Bitmap Index Scan
- [x] Test search performance with seed data across all modules
- [x] PR #8 created: `beta_1` → `main` — pending deploy and verify on Vercel

#### Week 3: RailBot Architecture & Backend (In Progress)
- [x] Design RailBot architecture (OpenAI API + Supabase data layer)
- [x] Build railbot.md architecture document
- [x] Define system prompt with RBAC-scoped context
- [x] Define function calling schemas mapped to server actions
- [x] Design conversation state management
- [x] Set up OpenAI API integration (SDK + API route)
- [x] Implement streaming responses
- [x] Build RBAC-scoped context builder
- [x] Implement function calling handlers
- [x] Create conversation Supabase tables with RLS

#### Week 4: RailBot Frontend & Polish
- [x] Build slide-over chat panel component
- [x] Message UI (bubbles, typing indicator, streaming)
- [x] Conversation history persistence
- [x] Mobile-optimized chat experience (safe area padding, responsive bubbles, keyboard scroll, compact header)
- [x] Write operation confirmation flows
- [x] Conversational RFI/punch list/daily log creation (crew language parsing)
- [x] Assignee resolution via team member lookup
- [x] Project summarization + daily log rollups
- [x] Chat panel polish (timestamps, thinking indicator, retry button, error messages)
- [x] Guard rails and security hardening (input validation, HTML stripping, argument validation)
- [x] Voice dictation (Whisper API + mic UI)

---

*Last updated: April 8, 2026 — Dashboard KPI cards clickable + pre-filter destination pages (Phase 12 Week 1)*
*Product: RailCommand — by A5 Rail*
*Developer: Dillan Milosevich, CTO — Creative Currents LLC*
