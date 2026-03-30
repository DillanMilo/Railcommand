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
- [x] Email Notifications (Resend integration, 5 notification types, preferences UI wired to backend)

### Phase 11: AI Assistant (RailBot) 🤖
**Architecture & Design** *(Week 3)*
- [x] Design RailBot architecture (OpenAI API + Supabase data layer)
- [x] Define system prompt with RBAC-scoped context injection
- [x] Define OpenAI function calling schemas (mapped to existing server actions)
- [x] Design conversation state management (Supabase tables + React state)
- [x] Create railbot.md architecture document

**Backend** *(Week 3–4)*
- [ ] Set up OpenAI API integration (openai SDK + `/api/chat` route)
- [ ] Implement streaming responses (Server-Sent Events)
- [ ] Build RBAC-scoped context builder (dynamic system prompt per user role)
- [ ] Implement function calling handlers (search submittals, RFIs, punch list, daily logs)
- [ ] Add read-only query functions (project summary, overdue items, budget summary)
- [ ] Add write operation functions with confirmation flow (create RFI, punch item, daily log)
- [ ] Create conversation & message Supabase tables with RLS policies
- [ ] Build conversation persistence (save/load/list conversations)
- [ ] Rate limiting and error handling for API calls

**Frontend** *(Week 4)*
- [ ] Build slide-over chat panel component (slides from right, any page)
- [ ] Build message bubbles (user/assistant), typing indicator, streaming text display
- [ ] Build message input with send button + Cmd+Enter shortcut
- [ ] Build conversation history sidebar (past conversations list)
- [ ] Mobile-optimized chat experience (full-screen on mobile)
- [ ] Add RailBot trigger button (floating action button or sidebar icon)

**Polish & Guardrails** *(Week 4)*
- [ ] Guard rails — read-heavy by default, confirm before any create/update actions
- [ ] Context window management (summarize large datasets)
- [ ] Auto-title conversations from first message
- [ ] Input sanitization and security hardening

### Alpha Bug Fixes (March 2026)
- [x] **BUG FIX: Calendar dates one day behind** — All date-only fields (due dates, log dates, target dates, etc.) were displaying one day behind what the user selected. Root cause: `new Date("YYYY-MM-DD")` interprets as UTC midnight, which shifts back one day in US timezones. Fix: Created `src/lib/date-utils.ts` with timezone-safe helpers (`getLocalDateString`, `getLocalDateStringOffset`, `formatDateSafe`, `parseDateSafe`). Replaced all `new Date(dateStr)` calls with `parseISO(dateStr)` from date-fns for display, and all `.toISOString().split('T')[0]` patterns with local timezone date string helpers. Fixed across all modules: dashboard, submittals, RFIs, daily logs, punch lists, schedule/milestones, and profile page.
- [x] **BUG FIX: Multiple photo uploads — only some photos persist** — When uploading 6+ photos, only 3-4 would actually appear after submission. Root cause: Photos were uploaded sequentially and failures were silently swallowed (only logged to console). Fix: Refactored `uploadPhotosAfterCreate` and `uploadFilesAfterCreate` to use `Promise.allSettled` for concurrent uploads, return structured results (success/fail counts), and report failures to the user. Updated all creation forms (daily logs, punch lists, RFIs, submittals) to show upload progress ("Uploading N photos…"), disable submit buttons during upload, and display error messages when uploads partially fail.

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
- [ ] Set up OpenAI API integration (SDK + API route)
- [ ] Implement streaming responses
- [ ] Build RBAC-scoped context builder
- [ ] Implement function calling handlers
- [ ] Create conversation Supabase tables with RLS

#### Week 4: RailBot Frontend & Polish
- [ ] Build slide-over chat panel component
- [ ] Message UI (bubbles, typing indicator, streaming)
- [ ] Conversation history persistence
- [ ] Mobile-optimized chat experience
- [ ] Write operation confirmation flows
- [ ] Guard rails and security hardening

---

*Last updated: March 30, 2026 — Week 3 RailBot Architecture & Design complete*
*Product: RailCommand — by A5 Rail*
*Developer: Dillan Milosevich, CTO — Creative Currents LLC*
