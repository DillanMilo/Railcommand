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
- [ ] Mobile responsiveness audit (every page)
- [ ] Touch target sizing audit (44px minimum)
- [ ] Color contrast accessibility check
- [x] Page transitions / micro-animations
- [x] Favicon and meta tags
- [ ] Deploy to Vercel

---

*Last updated: February 26, 2026*
*Product: RailCommand — by A5 Rail*
*Developer: Dillan Milosevich, CTO — Creative Currents LLC*
