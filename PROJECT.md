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

### Phase 11: AI Assistant (RailBot)
- [ ] Set up Claude API integration (Anthropic SDK + API route)
- [ ] Build chat UI component (slide-over panel, accessible from any page)
- [ ] Implement project data context layer (feed seed/Supabase data to the agent)
- [ ] Natural language queries — pull up submittals, RFIs, punch lists, logs by status/date/assignee
- [ ] Project summarization — daily log summaries, overdue item reports, budget snapshots
- [ ] Guided data entry — create RFIs, punch list items, and daily log entries via conversation
- [ ] Conversation history (per-user, per-project)
- [ ] Mobile-optimized chat experience
- [ ] Guard rails — read-heavy by default, confirm before any create/update actions
- [ ] Rate limiting and error handling for API calls

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

#### Week 2: Global Search Upgrade
- [ ] Upgrade search backend to query across all modules (submittals, RFIs, punch items, daily logs, milestones)
- [ ] Expand searchable fields: number, title, assignee, content (description, question/answer, work summary, safety notes, resolution notes)
- [ ] Add assignee name search via profile join (two-phase: text fields + profile name lookup)
- [ ] Add `matchField` and `assignee` metadata to search results for UI context
- [ ] Upgrade GlobalSearch command palette UI with assignee display, match indicators, and per-module result counts
- [ ] Build dedicated search results page (`/search?q=`) with module filter tabs, result cards, and responsive layout
- [ ] Upgrade demo mode search to include assignee name matching
- [ ] **Supabase backend:** Create PostgreSQL full-text search (GIN) indexes on all module tables
- [ ] **Supabase backend:** Create `global_search` RPC function for single-call search with `ts_rank` relevance scoring
- [ ] **Supabase backend:** Add B-tree indexes on `project_id` columns and `project_members.profile_id`
- [ ] **Supabase backend:** Seed 100+ records per module for performance testing
- [ ] **Supabase backend:** Run `EXPLAIN ANALYZE` to verify index usage and query performance
- [ ] Test search performance with seed data across all modules
- [ ] Deploy and verify on Vercel

#### Week 3: TBD
- [ ] (upcoming)

#### Week 4: TBD
- [ ] (upcoming)

---

*Last updated: March 24, 2026 — Week 2 Global Search Upgrade started*
*Product: RailCommand — by A5 Rail*
*Developer: Dillan Milosevich, CTO — Creative Currents LLC*
