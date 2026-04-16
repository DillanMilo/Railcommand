# RailCommand -- Feature Overview & Role-Based Access Guide

**Prepared for:** A5 Rail Leadership
**Date:** March 4, 2026
**Version:** 1.1 -- Updated with current development status

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Role-Based Access Overview](#2-role-based-access-overview)
3. [Module Features](#3-module-features)
   - [3.1 Dashboard](#31-dashboard)
   - [3.2 Submittals](#32-submittals-module)
   - [3.3 RFIs](#33-rfis-module)
   - [3.4 Daily Logs](#34-daily-logs-module)
   - [3.5 Punch List](#35-punch-list-module)
   - [3.6 Schedule & Milestones](#36-schedule--milestones)
   - [3.7 Team Management](#37-team-management)
   - [3.8 Settings & Profile](#38-settings--profile)
   - [3.9 AI Assistant (RailBot)](#39-ai-assistant-railbot)
   - [3.10 Project Documents](#310-project-documents-module)
   - [3.11 QC/QA Module](#311-qcqa-module)
   - [3.12 Photos & Media](#312-photos--media)
   - [3.13 Safety Module](#313-safety-module)
4. [Cross-Cutting Features](#4-cross-cutting-features)
5. [Permission Matrix (Complete Reference)](#5-permission-matrix-complete-reference)
6. [Current Development Status](#6-current-development-status)

---

## 1. Executive Summary

**RailCommand** is a purpose-built construction and rail project management platform developed for A5 Rail. It consolidates the key workflows of railroad construction -- submittals, RFIs, daily logs, punch lists, schedules, and team collaboration -- into a single, unified web application. By replacing fragmented spreadsheets, email chains, and disconnected tools, RailCommand gives every stakeholder a single source of truth from the office to the field.

The platform is built as a **web-first Progressive Web App (PWA)**, meaning it runs in any modern browser and can be installed directly to any device -- iPhone, Android, or desktop -- without an app store. Field crews get native-like speed and reliability on their phones, while project managers and engineers get a full-featured desktop experience. The interface is designed mobile-first with responsive layouts that adapt to any screen size, including bottom navigation for thumb-friendly mobile use.

RailCommand features a comprehensive **role-based access system** that operates on two layers: organization-level roles control systemwide permissions, while project-level roles govern what each team member can do within a specific project. This ensures that contractors see only what they need, inspectors can verify without modifying, and leadership gets high-level visibility without information overload. Every action is tracked in an audit trail, and financial data is restricted to authorized roles only.

The platform supports **dark mode** (with automatic scheduling from 7 PM to 6 AM), real-time activity feeds, in-app notifications, global search, skeleton loading screens, and polished error handling. All data is secured with row-level security policies and 256-bit encryption, with all data stored exclusively in the United States.

---

## 2. Role-Based Access Overview

RailCommand uses two layers of access control:

### Organization Roles (Systemwide)

| Role | Description |
|------|-------------|
| **Admin** | Full system access. Manages users, organizations, and all projects. |
| **Manager** | Manages assigned projects. Approves and rejects workflows. Full edit access within projects. |
| **Member** | Standard team member. Creates and edits within assigned projects based on project role. |
| **Viewer** | Read-only access. Typically inspectors or client stakeholders who need visibility without modification rights. |

### Project Roles (Per-Project)

| Role | Description |
|------|-------------|
| **Project Manager** | Overall project oversight. Approves submittals, manages the team, and sees all financial data. |
| **Superintendent** | Field operations lead. Creates daily logs, manages punch lists, and oversees the schedule. |
| **Foreman** | Field crew lead. Creates daily logs, punch list items, and tracks field work. |
| **Engineer** | Technical reviewer. Reviews and approves submittals, answers RFIs, and provides technical oversight. |
| **Contractor / Subcontractor** | Submits submittals, creates RFIs, and performs field work. |
| **Inspector** | Read-mostly access. Verifies completed punch list items, views all project data, and adds inspection notes. |
| **Owner / Client** | High-level visibility. Dashboard access, schedule overview, and read-only on most modules. |

### Module Access Matrix

| Module | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Dashboard** | Full Access | Full Access | Full Access | Full Access | Full Access | View Only | View Only |
| **Submittals** | Full Access | Create & Edit | Create & Edit | Full Access | Create & View | View Only | View Only |
| **RFIs** | Full Access | Create & Respond | Create & Respond | Full Access | Create & Respond | View Only | View Only |
| **Daily Logs** | Full Access | Create & Edit | Create & Edit | View Only | View Only | View Only | View Only |
| **Punch List** | Full Access | Create & Resolve | Create & Resolve | Verify & Reopen | Create Only | Verify Only | View Only |
| **Schedule** | Full Access | Edit Milestones | View Only | View Only | View Only | View Only | View + Budget |
| **Team** | Manage Members | View Only | View Only | View Only | View Only | View Only | View Only |
| **Settings** | Own Profile | Own Profile | Own Profile | Own Profile | Own Profile | Own Profile | Own Profile |

> **Note:** "Full Access" includes create, edit, review/approve, and delete capabilities. Budget and financial data visibility is restricted to Project Manager, Admin, and Owner/Client roles only.

---

## 3. Module Features

### 3.1 Dashboard -- *Complete*

**Overview**

The Dashboard is the command center for every project. It provides a real-time, at-a-glance view of project health through KPI cards, an activity feed, quick-action shortcuts, and an upcoming milestones widget. The dashboard adapts its content and visible data based on the user's role.

**Key Features**

- **KPI Cards** -- Six key performance indicator cards displayed in a responsive grid:
  - **Budget** -- Total project budget, amount spent, and percentage utilized
  - **Schedule** -- Overall schedule progress and on-track status
  - **Submittals** -- Total count with number pending review
  - **Open RFIs** -- Count of open RFIs with overdue highlighting
  - **Punch List** -- Number of open items with critical item count
  - **Daily Logs** -- Total logs filed with date of most recent entry
- **Recent Activity Feed** -- Chronological stream of project activity (submittals submitted, RFIs answered, punch items resolved, and more), filtered by relevance to the logged-in user's role
- **Quick Action Buttons** -- One-tap shortcuts to common actions (create submittal, new RFI, file daily log, add punch list item), dynamically showing only actions the user has permission to perform
- **Upcoming Milestones Widget** -- Displays the next milestones with status indicators (On Track, At Risk, Behind, Complete) and target dates
- **Budget Health Summary** -- Visual representation of budget utilization with trend indicators
- **Project Status Header** -- Project name, active status badge, and client name prominently displayed
- **Clickable KPI Boxes** -- All 6 dashboard boxes are tappable, navigating to their respective detail/module pages with pre-filtering (e.g., the Open RFIs card lands on RFIs filtered to status=open) *(Complete)*
- **Recent Activity Drilldown** -- Activity feed entries are tappable, linking to individual item detail views *(Complete)*
- **CPI (Cost Performance Index)** -- Earned Value / Actual Cost with color-coded indicators: >1.0 Under budget (green), =1.0 On budget (yellow), <1.0 Over budget (red) *(Complete)*
- **SPI (Schedule Performance Index)** -- Earned Value / Planned Value with same color coding *(Complete)*
- **Schedule Benchmark Dates** -- Display Turnover Date, Substantial Completion Date, and Project Completion Date in the Schedule box *(Complete)*

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View project KPIs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View budget/financial data | Yes | - | - | - | - | - | Yes |
| View activity feed | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Use quick actions | Yes | Yes | Yes | Yes | Yes | - | - |
| View milestones widget | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

---

### 3.2 Submittals Module -- *Complete (file attachment storage coming soon)*

**Overview**

The Submittals module manages the full lifecycle of construction submittals -- from initial draft through submission, review, and final disposition. Every submittal is tracked with a numbered identifier (e.g., SUB-001), a complete audit trail, and aging indicators that highlight overdue items.

**Key Features**

- **Submittal List** -- Searchable, filterable list of all project submittals with real-time status badges
- **Status Filters** -- Filter by Draft, Submitted, Under Review, Approved, Approved with Conditions, or Rejected
- **Submittal Detail View** -- Full detail page with description, specification section reference (e.g., "34 11 13 -- Track Construction"), timeline, and complete audit trail
- **Create Submittal Form** -- Structured form for title, description, spec section, due date, and document attachments
- **Review Workflow** -- Formal review actions: Approve, Approve with Conditions, Reject, or Request Revision -- each recorded with reviewer notes and timestamps
- **Aging Indicators** -- Visual indicators showing days overdue for items past their due date
- **Linked Documents** -- File attachments associated with each submittal
- **Milestone Linking** -- Submittals can be linked to project milestones for schedule tracking

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View submittals | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create submittal | Yes | Yes | Yes | Yes | Yes | - | - |
| Edit own submittal | Yes | Yes | Yes | Yes | Yes | - | - |
| Review / Approve / Reject | Yes | - | - | Yes | - | - | - |
| Add review notes | Yes | - | - | Yes | - | - | - |
| View audit trail | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

---

### 3.3 RFIs Module -- *Complete (file attachment storage coming soon)*

**Overview**

The RFIs (Requests for Information) module enables structured communication for technical questions that arise during construction. Each RFI follows a formal lifecycle with priority levels, assigned respondents, and a threaded response history.

**Key Features**

- **RFI List** -- Searchable, filterable list with numbered identifiers (e.g., RFI-001) and status badges
- **Status Filters** -- Filter by Open, Answered, Closed, or Overdue
- **RFI Detail View** -- Full question text, response thread, priority level, assignment, and dates
- **Create RFI Form** -- Structured form for subject, question, priority (Critical, High, Medium, Low), assigned respondent, due date, and attachments
- **Response Thread** -- Threaded responses with official response designation and author attribution
- **Priority Levels** -- Four levels (Critical, High, Medium, Low) with distinct color-coded indicators
- **Overdue Highlighting** -- RFIs past their due date are automatically flagged and visually highlighted
- **Milestone Linking** -- RFIs can be associated with project milestones
- **Closure Workflow** -- Formal close action that marks an RFI as resolved

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View RFIs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create RFI | Yes | Yes | Yes | Yes | Yes | - | - |
| Respond to RFI | Yes | Yes | Yes | Yes | Yes | - | - |
| Mark official response | Yes | - | - | Yes | - | - | - |
| Close RFI | Yes | - | - | Yes | - | - | - |
| View response thread | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

---

### 3.4 Daily Logs Module -- *Complete*

**Overview**

The Daily Logs module provides a structured, digital replacement for paper-based daily field reports. Each log captures weather conditions, personnel headcounts, equipment usage, work items completed, and safety notes -- all tied to a specific date and project.

**Key Features**

- **Calendar View** -- Visual calendar interface showing which dates have logs filed, with quick navigation
- **List View** -- Chronological list of all daily logs with summary information
- **Create Daily Log Form** -- Comprehensive, structured data entry:
  - **Weather** -- Temperature, conditions (sunny, cloudy, rain, snow, etc.), and wind
  - **Personnel** -- Tabular entry of crew roles, headcounts, and affiliated company
  - **Equipment** -- Equipment type, count, and notes
  - **Work Items** -- Description, quantity, unit of measure, and location
  - **Safety Notes** -- Free-text safety observations and incidents
  - **Work Summary** -- Overall summary of the day's activities
- **Daily Log Detail View** -- Read-only presentation of a completed log with all structured data sections, with PDF export button for downloading individual log reports
- **Photo Attachment Support** -- Upload site photos associated with the day's work
- **Searchable History** -- Find past logs by date, content, or personnel
- **7-Day Calendar View** -- Calendar displays full 7-day week instead of current view *(Complete)*
- **Weekly Reports Section** -- Fields for Construction Manager and Contractor weekly reports *(Planned)*

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View daily logs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create daily log | Yes | Yes | Yes | - | - | - | - |
| Edit own daily log | Yes | Yes | Yes | - | - | - | - |
| Edit any daily log (override) | Yes | - | - | - | - | - | - |
| View calendar | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View attachments | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

---

### 3.5 Punch List Module -- *Complete*

**Overview**

The Punch List module tracks deficiencies, incomplete work, and corrective actions throughout a project. Each item follows a formal resolution workflow with built-in separation of duties -- the person who resolves an item cannot be the same person who verifies it.

**Key Features**

- **Punch List View** -- Filterable list with status, priority, and assignee filters
- **Numbered Items** -- Each item has a unique identifier (e.g., PL-001) for easy reference
- **Create Punch List Item** -- Form for title, description, location, priority (Critical, High, Medium, Low), assignee, and due date
- **Resolution Workflow** -- Four-stage lifecycle:
  1. **Open** -- Item identified and logged
  2. **In Progress** -- Work has begun on the correction
  3. **Resolved** -- Correction completed by the assigned party
  4. **Verified** -- Independent verification that the work meets standards
- **Separation of Duties** -- The person who marks an item as resolved cannot verify it -- verification must come from an Inspector, Engineer, or Manager
- **Photo Attachment Support** -- Before/after photos and documentation
- **Priority-Based Sorting** -- Critical items are visually distinguished and sorted to the top
- **Location Tracking** -- Each item includes a location field for easy field identification

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View punch list | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create item | Yes | Yes | Yes | Yes | Yes | - | - |
| Start work (In Progress) | Yes | Yes | Yes | - | Yes | - | - |
| Mark resolved | Yes | Yes | Yes | - | Yes | - | - |
| Verify completion | Yes | - | - | Yes | - | Yes | - |
| Reopen item | Yes | - | - | Yes | - | Yes | - |
| View attachments | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

> **Important:** Verification must be performed by a different person than the one who resolved the item. This separation of duties ensures quality control and accountability.

---

### 3.6 Schedule & Milestones -- *Complete*

**Overview**

The Schedule & Milestones module provides a high-level view of project timelines, milestone tracking, and budget allocation per phase. It connects directly to submittals and RFIs, giving managers a clear picture of how document workflows affect the overall schedule.

**Key Features**

- **Milestone List** -- All project milestones displayed with status indicators:
  - **Not Started** -- Work has not begun
  - **On Track** -- Progressing as planned
  - **At Risk** -- May miss the target date
  - **Behind** -- Past the target date
  - **Complete** -- Milestone achieved
- **Timeline View** -- Visual timeline representation of milestone sequence and progress
- **Percentage Complete** -- Each milestone tracks its completion percentage
- **Budget Tracking per Milestone** -- Planned vs. actual budget for each milestone, visible only to authorized roles
- **Linked Submittals & RFIs** -- Each milestone shows associated submittals and RFIs, providing context on blocking items
- **Overall Schedule Health KPIs** -- Summary metrics for schedule performance across all milestones
- **Target vs. Actual Dates** -- Clear comparison of planned and actual completion dates
- **Change Orders** -- Full change order tracking integrated into the Schedule module:
  - Create, edit, approve/reject, and void change orders
  - Each CO has: number (CO-001), title, description, reason, amount (+/-), linked milestone
  - Status workflow: Draft → Submitted → Approved / Rejected / Void
  - Approved COs automatically adjust the project budget total on the dashboard
  - Dashboard Budget KPI reflects adjusted budget and shows pending CO count
  - CPI/SPI earned value calculations use the adjusted budget
  - Quick status transition buttons (Submit, Approve, Reject) on each card
  - Amount color-coded: red for cost increases, green for savings/deductions
- **Modifications & Amendments** -- Track plan revisions, specification amendments, contract amendments, design changes, and scope changes:
  - Each modification has: number (MOD-001), title, type, revision number, affected documents, linked milestone
  - Status workflow: Draft → Issued → Acknowledged → Implemented / Void
  - Five modification types: Plan Revision, Spec Amendment, Contract Amendment, Design Change, Scope Change
  - Auto-tracks acknowledged-by and effective dates on status transitions
  - Integrated as 4th tab in Schedule module alongside Milestones, Timeline, and Change Orders

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View schedule/milestones | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Edit milestones | Yes | Yes | - | - | - | - | - |
| Manage change orders | Yes | Yes | - | Yes | - | - | - |
| View budget data | Yes | - | - | - | - | - | Yes |
| View linked submittals/RFIs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View schedule health KPIs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

> **Note:** Budget and financial data per milestone is hidden from Contractor, Foreman, and other field roles. Only Project Managers, Admins, and Owner/Client roles can view financial figures.

---

### 3.7 Weekly Reports -- *Complete*

**Overview**

The Weekly Reports module enables Construction Managers (CM) and Contractors to submit structured weekly progress reports. Reports cover work accomplished, schedule status, safety, weather impact, upcoming work, and workforce metrics. Reports follow a review workflow (Draft → Submitted → Approved/Rejected).

**Key Features**

- **Two Report Types** -- CM Reports (construction management perspective) and Contractor Reports (field execution perspective)
- **Structured Sections** -- Each report includes:
  - Work Summary -- what was accomplished this week
  - Schedule Summary -- progress against milestones, delays, critical path
  - Safety Summary -- incidents, observations, toolbox talks
  - Weather Summary -- conditions and impact on work
  - Issues & Concerns -- risks, blockers, coordination needs
  - Upcoming Work -- planned activities for next week
- **Workforce Metrics** -- Manpower total (headcount) and equipment hours per week
- **Week-Based Dating** -- Reports tied to Mon–Sun week periods with auto-calculated end date
- **Status Workflow** -- Draft → Submitted → Approved / Rejected with one-click status transitions
- **Filterable List** -- Filter by report type (CM/Contractor) and status (Draft/Submitted/Approved/Rejected)
- **Search** -- Search across report titles and work summaries
- **Responsive Design** -- Desktop table view + mobile card layout
- **Navigation** -- "Reports" nav item in sidebar and mobile nav (More menu)

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View weekly reports | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create/edit reports | Yes | Yes | - | Yes | Yes | - | - |
| Approve/reject reports | Yes | Yes | - | Yes | - | - | - |
| Delete reports | Yes | Yes | - | Yes | Yes | - | - |

> **Note:** Contractors typically submit Contractor Reports while CMs submit CM Reports, but the system does not enforce which type a role can create.

---

### 3.8 Team Management -- *Complete*

**Overview**

The Team Management module provides a directory of all project team members, their roles, organizations, and contact information. It supports adding new members from the existing user directory or creating brand-new user accounts and organizations directly from the team page.

**Key Features**

- **Project Team Directory** -- Card-based grid showing each team member with avatar, name, role badge, organization, email, and phone
- **Member Count** -- Total team member count displayed in the header
- **Add Existing Member** -- Search and add users already registered in the system, then assign them a project role
- **Create New Member** -- Full registration flow: enter name, email, phone, select or create an organization, and assign a project role
- **Create Organization** -- Inline option to create a new organization (with type: Contractor, Engineer, Owner, or Inspector) while adding a member
- **Assign Project Roles** -- Choose from Manager, Engineer, Contractor, Inspector, Foreman, or Superintendent
- **Remove Team Members** -- Hover-to-reveal remove button on each team member card
- **Contact Integration** -- Direct email and phone links for each team member
- **Team Listing Prominence** -- Team directory surfaced directly on dashboard or sidebar instead of behind "More" button *(Complete)*
- **RBAC Management UI** -- Managers can change any team member's role directly from their card via dropdown. Collapsible Permissions Reference table shows a full matrix of all 20 actions across all 7 roles *(Complete)*

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View team directory | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Add team member | Yes | - | - | - | - | - | - |
| Remove team member | Yes | - | - | - | - | - | - |
| Create new user account | Yes | - | - | - | - | - | - |
| Create organization | Yes | - | - | - | - | - | - |
| Change project roles | Yes | - | - | - | - | - | - |

> **Note:** Admin-level users (organization role) have full team management capabilities regardless of their project role.

---

### 3.8 Settings & Profile -- *Complete*

**Overview**

Settings and Profile pages allow every user to manage their personal information, customize their experience, and control their notification preferences. Profile settings also display organization membership details and current project assignment.

**Key Features**

- **Profile Management:**
  - Edit full name and phone number
  - View email address (read-only; admin change required)
  - Avatar upload with image preview and Supabase Storage backing (PNG, JPEG, WebP, GIF up to 5MB); falls back to initials when no avatar set
  - View organization name, type, and membership date
  - View current project assignment and access level
  - Self-service password reset — sends a reset email via the Resend SMTP integration
- **Appearance Settings:**
  - **Light Mode** -- Clean, bright interface
  - **Dark Mode** -- Reduced-glare dark theme for low-light environments
  - **Auto Mode** -- Automatically switches to dark mode from 7 PM to 6 AM
- **Time Zone Settings:**
  - Curated list of common IANA timezones (Americas, Europe, Asia/Pacific) with live UTC offsets
  - "Auto (browser)" option to use the browser-detected timezone
  - Persisted to user profile so all dates and times across the app render in the user's local zone
- **Notification Preferences** (toggle on/off per category):
  - Email notifications for project activity
  - Submittal status change alerts
  - RFI assignment notifications
  - Daily log filing reminders
  - Punch list assignment and resolution updates
- **Security:**
  - Change password (with strength meter and validation)
  - View active sessions (device, location, and status)
  - Sign out of all devices
- **Account Actions:**
  - Sign out
  - Delete account (admin-assisted process for data safety)

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Edit own profile | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Change theme | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Manage notifications | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Change own password | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View own sessions | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Manage other users' settings | Admin Only | - | - | - | - | - | - |

---

### 3.9 AI Assistant (RailBot) -- *In Progress (Frontend & Voice Complete)*

**Overview**

RailBot is an AI-powered assistant that gives every team member a conversational interface to query project data, create records, and get actionable summaries -- all without navigating through menus. Accessible from any page via a floating action button, RailBot understands natural language and enforces the same role-based permissions as the rest of the platform.

**Key Features**

- **Chat Interface** -- Slide-over panel accessible from any page via floating action button
- **OpenAI Integration** -- GPT-4.1-mini for fast, cost-effective responses with streaming (SSE)
- **Natural Language Queries** -- Ask questions like "What submittals are overdue?", "Show me the project summary", "Who is on the team?"
- **14 Function Tools** -- 10 read tools (search submittals/RFIs/punch list/daily logs, project summary, overdue items, budget summary, team members, milestones, recent activity) + 3 write tools (create RFI, punch list item, daily log) + notifications summary
- **RBAC-Aware** -- Triple-layer permission enforcement:
  - System prompt scoped to user's role and allowed actions
  - Tool visibility filtered per role (e.g., foreman never sees budget tools)
  - Tool executor permission checks before data access
  - Budget data stripped from responses for unauthorized roles
- **Voice Dictation** -- Microphone input with real-time soundwave animation, auto-transcription via OpenAI Whisper API
- **Conversation Persistence** -- Chat history saved to Supabase, browse and resume past conversations, auto-titled from first message
- **Write Confirmation** -- AI confirms all create operations with the user before executing, showing full details of what will be created via a 6-step confirmation protocol
- **Conversational Data Entry** -- Field crew can create RFIs, punch list items, and daily logs using natural language (e.g., "log an RFI about the broken signal box at MP 42, high priority, assign to Bobby"). RailBot parses intent, fills fields, resolves assignees by name, and confirms before creating.
- **Context Management** -- 20-message sliding window for optimal token usage and cost efficiency
- **Demo Mode Support** -- Full functionality in demo mode using seed data
- **Suggested Prompts** -- Quick-start actions for common queries
- **Mobile Responsive** -- Full-screen chat on mobile, slide-over on desktop, iOS safe area padding, responsive bubble widths, keyboard scroll handling, compact header on small screens
- **Daily Log Rollups** -- Summarize daily log activity over a date range (weekly/monthly) via get_daily_log_rollup tool
- **Summarization** -- Project summary with KPIs and overdue counts, daily log rollups, "Summarize this week's work" quick action
- **Error Handling** -- Status-specific error messages (401, 403, 429, 502), retry button on failed messages, "Thinking..." indicator during tool calls
- **Input Sanitization** -- HTML stripping, 2000-char message limit (server + client enforced), projectId validation, write tool argument validation, character counter near limit

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Access RailBot chat | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Query submittals / RFIs / punch list / daily logs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Query budget data | Yes | - | - | - | - | - | Yes |
| Query team members | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Query milestones / schedule | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create RFI via chat | Yes | Yes | Yes | Yes | Yes | - | - |
| Create punch list item via chat | Yes | Yes | Yes | Yes | Yes | - | - |
| Create daily log via chat | Yes | Yes | Yes | - | - | - | - |

> **Note:** RailBot enforces the same RBAC rules as the standard UI. Tools and data that a role cannot access in the app are also hidden from the AI assistant. Budget figures are stripped from AI responses for unauthorized roles.

---

### 3.10 Project Documents Module -- *Complete*

**Overview**

The Project Documents module provides centralized document management with revision tracking, category organization, and an approval workflow. Every team member can see which revision is current at a glance.

**Key Features**

- **8 Document Categories** -- Drawings, Specifications, Submittals, Reports, Contracts, Correspondence, Photo Logs, Other
- **Revision Tracking** -- Each document tracks revision number (Rev 0, Rev A, etc.) and revision date
- **Status Workflow** -- Draft → Issued → Under Review → Approved → Superseded
- **Category Tabs** -- Filter documents by category with tabbed navigation
- **Status Filtering** -- Filter by document status with pill buttons
- **Search** -- Search across title, description, and file name
- **File Metadata** -- Track file name, file size (formatted KB/MB), upload date
- **Linked Milestones** -- Optionally link documents to project milestones
- **Review Tracking** -- Auto-records reviewer and review date on approval
- **Responsive Design** -- Desktop table + mobile card layout

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View documents | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create/edit documents | Yes | Yes | - | Yes | - | - | - |
| Approve documents | Yes | Yes | - | Yes | - | - | - |
| Delete documents | Yes | Yes | - | Yes | - | - | - |

---

### 3.11 QC/QA Module -- *Complete*

**Overview**

The QC/QA module brings Quality Control and Quality Assurance reporting into RailCommand with structured nonconformance tracking, a close-out workflow, and bidirectional links to the Punch List.

**Key Features**

- **4 Report Types** -- Inspection, Nonconformance (NCR), Test, Audit
- **Nonconformance Tracking** -- Flag reports as NCRs with severity levels (Minor, Major, Critical)
- **Close-Out Workflow** -- Draft → Open → In Review → Closed with auto-tracked close date and closer
- **Punch List Linking** -- Link QC/QA items directly to open Punch List items for bidirectional traceability
- **Structured Fields** -- Spec reference, location, findings, corrective action required
- **Type Tabs** -- Filter by report type (Inspections, Nonconformances, Tests, Audits)
- **Status Filtering** -- Filter by status with pill buttons
- **Search** -- Search across title, findings, and spec references
- **Severity Indicators** -- Color-coded severity badges on each report
- **Responsive Design** -- Desktop table + mobile card layout
- **QC/QA Plan per Project** -- *(Planned for future release)*

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View QC/QA reports | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create QC/QA report | Yes | Yes | - | Yes | - | Yes | - |
| Close QC/QA report | Yes | Yes | - | Yes | - | Yes | - |
| Delete QC/QA report | Yes | Yes | - | Yes | - | - | - |

---

### 3.12 Photos & Media -- *Complete*

**Overview**

Centralized photo gallery aggregating all project images across modules (Daily Logs, Punch Lists, RFIs, Submittals, Safety). Mobile-first camera capture with auto-save, GPS geo-tagging, and automatic date-based organization.

**Key Features**

- **Photos Bin** (`/projects/[id]/photos/`) -- Centralized gallery showing all project photos across every module in one place
- **Camera Capture** -- "Take Photo" button uses device camera via `capture="environment"`, compresses image, captures GPS, and uploads in one tap
- **Auto-Organization by Date** -- Photos automatically grouped by capture date with smart headers (Today, Yesterday, This Week, or full date)
- **Geo-Tag Capture** -- Latitude/longitude captured from device GPS at photo time; displayed as clickable Google Maps link in lightbox
- **Timestamp Capture** -- Original capture timestamp preserved and displayed alongside upload time
- **Filter Tabs** -- All, Standard, and Thermal photo filters with live counts
- **Lightbox Detail** -- Click any photo for full-size view with metadata panel: file size, capture time, upload date, entity type, GPS coordinates
- **Entity Badges** -- Each photo shows which module it belongs to (Daily Log, RFI, Punch List, etc.)
- **Standalone Project Photos** -- Photos captured from the Photos page are stored as `project_photo` entity type, not tied to any specific module item
- **Signed URLs** -- Private bucket photos served via time-limited signed URLs (1-hour expiry)
- **Image Compression** -- Standard photos compressed to max 1920px / JPEG 0.75 quality; thermal images preserved unchanged
- **Future (V2.5):** Live camera integration with Z-P-T (zoom/pan/tilt) controls, photo logs, and time-lapse video generation

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View photos | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Upload photos | Yes | Yes | Yes | - | - | - | - |
| Delete own photos | Yes | Yes | Yes | - | - | - | - |
| Delete any photo | Yes | - | - | - | - | - | - |
| Download photos | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

---

### 3.13 Safety Module -- *Complete*

**Overview**

The Safety module provides dedicated tracking for safety incidents, observations, and reporting -- elevating safety from a free-text field on the daily log into a first-class part of the platform. The exact placement (its own dashboard box vs. integrated within Daily Logs) is TBD based on field feedback.

**Key Features**

- **Safety Tracking** -- Dedicated tracking view for all safety entries across a project (placement TBD: own dashboard box or integrated within Daily Logs)
- **Incident Reporting** -- Structured fields for incident type, severity, personnel involved, location, root cause, and corrective action
- **Safety Notes per Daily Log** -- The existing free-text safety field in daily logs is preserved and rolled up into a dedicated safety tracking view
- **Severity & Type Filters** -- Filter incidents by severity (near-miss, first-aid, recordable, lost-time) and type
- **Photo Attachments** -- Attach photos to incidents and observations
- **Trend Reporting** -- Aggregate view of safety metrics over time (incident rate, types, locations)

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View safety entries | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create safety entry | Yes | Yes | Yes | Yes | Yes | Yes | - |
| Edit own entry | Yes | Yes | Yes | Yes | Yes | Yes | - |
| Edit any entry | Yes | - | - | - | - | - | - |
| View trend reports | Yes | Yes | Yes | Yes | - | Yes | Yes |

---

## 4. Cross-Cutting Features

These capabilities span the entire application and are available across all modules.

### Authentication & Security -- *Complete*

- **Email/Password Sign-In** -- Standard email and password authentication with form validation
- **Google OAuth** -- One-click sign-in with Google for faster access
- **Account Registration** -- Sign-up flow with password strength meter (Weak / Fair / Good / Strong)
- **First-Run Onboarding Wizard** -- New users land in a 3-step wizard after sign-up: Welcome (product overview), Profile (name, phone, job title), and Business Setup (organization name, type, role). Stepper shows progress, back/forward navigation preserves input. Replaces the previous abrupt one-step "Set up your business" form. Beta feedback drove this on April 8, 2026.
- **Password Reset** -- Self-service forgot-password flow via email reset link
- **Row-Level Security** -- Database-level access control ensures users can only access data they are authorized to see
- **Private Photo Storage** -- Project photos and thermal images stored in private Supabase Storage buckets with signed URLs (1-hour expiry). RLS policies scope file access to authenticated project members only. Client bundle verified clean of server secrets.
- **256-Bit Encryption** -- All data encrypted in transit and at rest
- **US Data Residency** -- All data stored exclusively within the United States
- **Session Management** -- View and manage active sessions across devices
- **Remember Me** -- Persistent login sessions with secure cookie-based session management
- **Demo Mode** -- "Explore Demo Project" button on the login page loads a fully populated railroad project with seed data so testers can explore all features without signing up
- **Fresh Account** -- New sign-ups get a clean canvas with zero pre-populated data, ready to create their own projects from scratch

### Progressive Web App (PWA) -- *Complete*

- **Add to Home Screen** -- Install RailCommand on any device directly from the browser, no app store required. Enhanced web app manifest with branded icons, maskable icons, shortcuts, and screenshots *(complete)*
- **Device-Specific Instructions** -- Guided Installation Guide UI in Settings with platform-specific instructions for iOS (Safari), Android (Chrome), and Desktop (Chrome/Edge) *(complete)*
- **Native-Like Experience** -- Runs in its own window without browser chrome once installed, with standalone mode detection *(complete)*
- **Instant Access** -- Launch from your home screen or app drawer like any other app *(complete)*
- **Smart Install Prompt** -- Custom PWA install prompt hook with beforeinstallprompt capture, install triggers, and update notifications *(complete)*
- **Offline Support** -- Service worker with offline fallback page, improved caching strategies, and offline status detection *(complete)*

### Dark Mode -- *Complete*

- **Three Modes** -- Light, Dark, and Auto
- **Auto Mode** -- Intelligent scheduling that activates dark mode from 7 PM to 6 AM
- **System-Wide** -- Every screen, component, and module fully supports dark mode
- **Field-Friendly** -- Reduces glare and eye strain for outdoor and low-light field conditions

### Responsive Design -- *Complete*

- **Mobile-First** -- Every screen designed for mobile viewports first, then enhanced for larger screens
- **Desktop Optimization** -- Full-width layouts, multi-column grids, and sidebar navigation on desktop
- **Bottom Navigation** -- Thumb-friendly tab bar for mobile navigation
- **Collapsible Sidebar** -- Desktop sidebar collapses to save space when needed
- **Touch Targets** -- Minimum 44px touch targets throughout for accessibility
- **Responsive Grids** -- KPI cards, team members, and list views adapt from 1 to 6 columns based on screen size

### In-App Notifications -- *Complete*

- **In-App Notification Panel** -- Bell icon opens a slide-over panel organized into two collapsible categories: **Updates** (product patch notes with version badges) and **Activity** (project submittals, RFIs, daily logs, punch items, milestones). Each category has its own unread count badge, collapses/expands on tap, and auto-opens when it has unread items. Individual notifications support mark-as-read and dismiss actions. Global "Mark all as read" in the header. Read and dismiss state persisted via localStorage. Fully responsive on mobile with 44px touch targets. *(complete)*
- **Role-Filtered Activity** -- Activity feed shows items relevant to the user's role and assignments *(complete)*
- **Per-Module Toggles** -- Users can enable or disable notifications for each module independently (8 categories) *(complete)*
- **Email Notifications** -- Automated email alerts via Resend for 8 notification types: submittal status changes, RFI assignments, RFI responses, punch list assignments, punch list status changes, overdue reminders (daily digest), daily log filing reminders, and team updates (member added/removed). Sent from `noreply@railcommand.a5rail.com` *(complete)*
- **Overdue Digest Emails** -- Cron-driven daily digest of overdue RFIs and submittals, grouped per user per project *(complete)*
- **Daily Log Reminders** -- Cron-driven afternoon reminder for project members who haven't filed a daily log *(complete)*
- **Supabase Auth SMTP** -- Custom SMTP via Resend replaces Supabase's built-in 3/hour throttle for all auth emails (sign-up, password reset, magic link, email change) *(configured)*
- **Push Notifications** -- Real-time browser push notifications *(coming soon)*

### Role-Based Access Control (RBAC) -- *Complete*

RailCommand enforces role-based permissions across every module in the application. This is not just a design concept -- it is fully implemented in the current MVP frontend.

- **Permission Matrix Engine** -- A centralized permission module defines 12 distinct actions (create submittals, review submittals, create RFIs, respond to RFIs, close RFIs, create daily logs, create punch items, resolve punch items, verify punch items, manage team, manage project, view budget) mapped to all 7 project roles
- **Per-Page Enforcement** -- Every page in the app checks the current user's project role before rendering action buttons. Unauthorized actions are hidden entirely (not grayed out), keeping the interface clean and role-appropriate
- **URL Protection** -- Direct navigation to create/edit pages (e.g., typing `/submittals/new` in the browser) is also gated -- unauthorized users see an "Access Denied" message instead of the form
- **Budget Restriction** -- Financial data (budget KPI on dashboard, milestone budgets) is only visible to Project Managers, Superintendents, Engineers, and Owner/Client roles. Other roles see a "Restricted" placeholder
- **Quick Actions Filtering** -- Dashboard quick-action shortcuts dynamically show only the actions permitted for the current user's role
- **Project Management Gating** -- Sidebar actions (Mark Complete, Archive, Delete project) are only visible to users with the Project Manager role
- **Team Management Gating** -- Add/remove team member controls are restricted to Project Managers only

**MVP Demo Note:** The current MVP includes a **User Switcher** in the top-right dropdown menu. This development tool allows you to switch between all 10 seed users to demonstrate how the interface adapts to each role in real time. This switcher will be removed before production deployment -- in the shipped product, the user's role is determined automatically by their Supabase authentication credentials and project membership. The switcher exists solely for client demos and internal testing.

### Navigation & Usability -- *Complete*

- **Global Search** -- Search across all modules from the top bar *(page-level navigation complete; full-text cross-module search coming soon)*
- **Sidebar Navigation** -- Collapsible navy sidebar with project switcher, role-aware nav items, tightened spacing and high-contrast labels, and active-state highlight. Beta feedback drove the spacing/contrast pass on April 8, 2026.
- **Breadcrumb Navigation** -- Persistent breadcrumbs on every page showing the user's location in the app
- **Skeleton Loading Screens** -- Polished placeholder content displayed while data loads
- **Empty States** -- Helpful messaging when no data exists, with guidance on next steps
- **Error Boundaries** -- Graceful error handling with user-friendly error messages instead of blank screens
- **Page Transitions** -- Smooth micro-animations between views for a polished feel

---

## 5. Permission Matrix (Complete Reference)

The following table provides a comprehensive reference of every action in RailCommand mapped to each project role. Organization-level Admin users have full access to all actions regardless of project role.

| # | Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|---|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| | **Dashboard** | | | | | | | |
| 1 | View project KPIs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 2 | View budget / financial data | Yes | - | - | - | - | - | Yes |
| 3 | View activity feed | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 4 | Use quick action buttons | Yes | Yes | Yes | Yes | Yes | - | - |
| 5 | View upcoming milestones | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| | **Submittals** | | | | | | | |
| 6 | View submittals list | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 7 | View submittal detail | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 8 | Create submittal | Yes | Yes | Yes | Yes | Yes | - | - |
| 9 | Edit own submittal | Yes | Yes | Yes | Yes | Yes | - | - |
| 10 | Review submittal | Yes | - | - | Yes | - | - | - |
| 11 | Approve submittal | Yes | - | - | Yes | - | - | - |
| 12 | Approve with conditions | Yes | - | - | Yes | - | - | - |
| 13 | Reject submittal | Yes | - | - | Yes | - | - | - |
| 14 | Request revision | Yes | - | - | Yes | - | - | - |
| 15 | View audit trail | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| | **RFIs** | | | | | | | |
| 16 | View RFIs list | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 17 | View RFI detail / thread | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 18 | Create RFI | Yes | Yes | Yes | Yes | Yes | - | - |
| 19 | Respond to RFI | Yes | Yes | Yes | Yes | Yes | - | - |
| 20 | Mark response as official | Yes | - | - | Yes | - | - | - |
| 21 | Close RFI | Yes | - | - | Yes | - | - | - |
| | **Daily Logs** | | | | | | | |
| 22 | View daily logs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 23 | View calendar view | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 24 | Create daily log | Yes | Yes | Yes | - | - | - | - |
| 25 | Edit own daily log | Yes | Yes | Yes | - | - | - | - |
| 26 | Edit any daily log (override) | Yes | - | - | - | - | - | - |
| 27 | View / download attachments | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| | **Punch List** | | | | | | | |
| 28 | View punch list | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 29 | Create punch list item | Yes | Yes | Yes | Yes | Yes | - | - |
| 30 | Start work (mark In Progress) | Yes | Yes | Yes | - | Yes | - | - |
| 31 | Mark item as resolved | Yes | Yes | Yes | - | Yes | - | - |
| 32 | Verify completed item | Yes | - | - | Yes | - | Yes | - |
| 33 | Reopen item | Yes | - | - | Yes | - | Yes | - |
| 34 | View / download attachments | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| | **Schedule & Milestones** | | | | | | | |
| 35 | View schedule / milestones | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 36 | Edit milestones | Yes | Yes | - | - | - | - | - |
| 37 | View milestone budget data | Yes | - | - | - | - | - | Yes |
| 38 | View linked submittals / RFIs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 39 | View schedule health KPIs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| | **Team Management** | | | | | | | |
| 40 | View team directory | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 41 | Add existing member to project | Yes | - | - | - | - | - | - |
| 42 | Create new user account | Yes | - | - | - | - | - | - |
| 43 | Create new organization | Yes | - | - | - | - | - | - |
| 44 | Remove member from project | Yes | - | - | - | - | - | - |
| 45 | Assign / change project roles | Yes | - | - | - | - | - | - |
| | **Settings & Profile** | | | | | | | |
| 46 | Edit own profile (name, phone) | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 47 | Change own password | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 48 | Set theme preference | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 49 | Manage notification preferences | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 50 | View own active sessions | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 51 | Sign out all devices | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 52 | Manage other users' accounts | Admin Only | - | - | - | - | - | - |
| | **Project Documents** *(Planned)* | | | | | | | |
| 53 | View project documents | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 54 | Upload new revision | Yes | Yes | - | Yes | Yes | - | - |
| 55 | Manage revision history | Yes | - | - | Yes | - | - | - |
| 56 | Delete document | Yes | - | - | Yes | - | - | - |
| 57 | Download CAD originals | Yes | Yes | - | Yes | Yes | - | - |
| | **QC/QA** *(Planned)* | | | | | | | |
| 58 | View QC/QA reports | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 59 | Create QC/QA report | Yes | Yes | Yes | Yes | - | Yes | - |
| 60 | Edit QC/QA report | Yes | Yes | Yes | Yes | - | - | - |
| 61 | Log nonconformance item | Yes | Yes | Yes | Yes | - | Yes | - |
| 62 | Verify / close nonconformance | Yes | - | - | Yes | - | Yes | - |
| 63 | Submit / route QC/QA plan | Yes | - | - | Yes | - | - | - |
| 64 | Approve / reject QC/QA plan | Yes | - | - | Yes | - | - | - |
| | **Photos & Media** *(Planned)* | | | | | | | |
| 65 | View photos | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 66 | Upload photos | Yes | Yes | Yes | - | - | - | - |
| 67 | Delete own photos | Yes | Yes | Yes | - | - | - | - |
| 68 | Delete any photo | Yes | - | - | - | - | - | - |
| 69 | Download photos | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| | **Safety** *(Planned)* | | | | | | | |
| 70 | View safety entries | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| 71 | Create safety entry | Yes | Yes | Yes | Yes | Yes | Yes | - |
| 72 | Edit own safety entry | Yes | Yes | Yes | Yes | Yes | Yes | - |
| 73 | Edit any safety entry | Yes | - | - | - | - | - | - |
| 74 | View safety trend reports | Yes | Yes | Yes | Yes | - | Yes | Yes |

> **Legend:** "Yes" = Permitted | "-" = Not Permitted | "Admin Only" = Requires organization-level Admin role

---

## 6. Current Development Status

### Overall Progress: ~95% Complete -- Beta Ready

RailCommand has reached **Beta readiness** as of March 2026. All eight core modules are fully functional with complete role-based access control, responsive design, and Supabase backend integration. All four beta-blocking features (PWA, global search, file storage, email notifications) are now implemented. The platform is ready for client and field testers.

### Module Completion Summary

| Module | Status | Completion | Notes |
|--------|--------|:----------:|-------|
| **Dashboard** | Complete | 100% | All KPI cards, activity feed, quick actions, milestones widget |
| **Submittals** | Complete | 100% | Full workflow operational; PDF export ready; file attachment storage connected |
| **RFIs** | Complete | 100% | Full lifecycle with response threads; PDF export ready; file attachment storage connected |
| **Daily Logs** | Complete | 100% | Calendar view, structured data entry, geo-tagging, photos, PDF export |
| **Punch List** | Complete | 100% | 4-stage resolution workflow with separation of duties, PDF export |
| **Schedule & Milestones** | Complete | 100% | Timeline view, budget tracking, linked submittals/RFIs, PDF export |
| **Team Management** | Complete | 100% | Full invite/add/remove workflow with role assignment |
| **Settings & Profile** | Complete | 100% | Profile editing, dark mode, notification preferences, security |
| **Project Documents** | Complete | 100% | Revision tracking, category filtering, milestone linking, approval workflow |
| **QC/QA** | Complete | 100% | Inspections, nonconformance, tests, audits with punch list linking |
| **Photos & Media** | Complete | 100% | Mobile camera capture, GPS geo-tagging, date grouping, lightbox, delete |
| **Enterprise Demo System** | Complete | 100% | Slug-based auto-auth, team + prospect presets, admin dashboard, reset/wipe, data isolation via RLS |
| **Safety** | Complete | 100% | Incident reporting (6 types, 4 severities), status workflow, investigation fields, photo attachments, PDF-ready. Smoke tested 2026-04-12. |

### Platform Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| **Authentication (Email + Google OAuth)** | Complete | Supabase Auth with password reset, remember me, session management |
| **Role-Based Access Control (RBAC)** | Complete | 14 actions mapped to 7 project roles, enforced on every page |
| **Dark Mode (Light / Dark / Auto)** | Complete | Auto mode switches at 7 PM / 6 AM; every screen supported |
| **Responsive Design** | Complete | Mobile-first with bottom nav, collapsible sidebar, 44px touch targets |
| **Skeleton Loading & Error Handling** | Complete | Loading states, empty states, error boundaries throughout |
| **Page Transitions** | Complete | Smooth micro-animations between views |
| **In-App Notification Panel** | Complete | Activity feed in topbar; per-module toggle preferences |
| **Breadcrumb Navigation** | Complete | On every page with responsive truncation |
| **Demo Mode** | Complete | "Explore Demo Project" with fully populated seed data |
| **Tier-Based Limits** | Complete | Free (5 members), Pro (25 members), Enterprise (unlimited) |
| **PDF Report Export** | Complete | Export PDF reports for Submittals, RFIs, Daily Logs, Punch List, Schedule. Report templates and `@react-pdf/renderer` are lazy-loaded on-click so the PDF stack never ships in the initial page bundle |
| **PWA Manifest & App Icons** | Complete | Web app manifest, service worker, installable to home screen |
| **Cross-Module Global Search** | Complete | Cmd+K command palette searches across all modules |
| **File & Document Storage** | Complete | Supabase Storage integration with drag & drop FileUpload component |
| **Email Notifications** | Complete | Resend integration with 8 notification types (assignments, status changes, overdue digests, daily log reminders, team updates), Vercel Cron for scheduled emails, custom SMTP for Supabase Auth, user preferences wired to Supabase |
| **AI Assistant (RailBot)** | In Progress | GPT-4.1-mini with SSE streaming, 13 function tools, triple-layer RBAC, demo mode support; frontend, voice dictation & persistence complete |

### What's Coming Next

The following features are actively planned for upcoming releases, ordered by priority:

| # | Feature | Description | Target |
|---|---------|-------------|--------|
| 1 | ~~**File & Document Storage**~~ | ~~Connect Supabase Storage buckets for file uploads.~~ | **Complete** |
| 2 | ~~**PWA Manifest & App Icons**~~ | ~~Add web app manifest, service worker, and branded icons.~~ | **Complete** |
| 3 | ~~**Cross-Module Search**~~ | ~~Upgrade global search to query across all modules.~~ | **Complete** |
| 4 | ~~**Email Notifications**~~ | ~~Automated email alerts when users are assigned items or statuses change.~~ | **Complete** |
| 5 | **AI Assistant (RailBot)** | Natural language queries, guided data entry (create RFIs and punch items via conversation), project summarization, and daily log summaries -- powered by AI and accessible from any page via a slide-over chat panel. 13 function tools with triple-layer RBAC enforcement. Voice dictation, conversation persistence, write confirmation flows. | **In Progress** (Frontend & Voice Complete) |
| 6 | **Custom Reporting & Export** | PDF export is now available for all modules (Submittals, RFIs, Daily Logs, Punch List, Schedule). CSV export and custom date range/status/role filtering coming next. | Phase 1 Complete |
| 7 | **Multi-Project Portfolio View** | A portfolio dashboard for leadership to monitor all active projects, compare KPIs, and allocate resources across projects. | Post-Beta |
| 8 | **Offline Mode** | Full offline capability for field use -- create daily logs, punch items, and RFIs without connectivity, with automatic sync when back online. | Post-Beta |
| 9 | ~~**Email Digests**~~ | ~~Configurable daily or weekly email summaries of project activity, overdue items, and upcoming milestones.~~ Overdue digest and daily log reminders now live via Vercel Cron. Weekly project summary digest remaining. | **Partially Complete** |
| 10 | **Dashboard Interactivity** | Clickable KPI boxes, drillable activity feed, CPI/SPI metrics | Clickable KPI boxes Complete (Apr 8); drillable activity feed and CPI/SPI metrics still pending |
| 11 | **Project Documents Module** | New module with revision tracking, PDF requirements, CAD folder structure | Sprint Week 1 (Apr 13-17) |
| 12 | **Safety Module** | Dedicated safety tracking with incident reporting | Sprint Week 2 (Apr 20-24) |
| 13 | **QC/QA Module** | Nonconformance tracking, Punch List linking, routable QC/QA plans | Sprint Week 3 (Apr 27-May 1) |
| 14 | **Photos & Media** | Mobile photo capture with auto-organization, geo-tags, metadata | Sprint Week 3 (Apr 27-May 1) |
| 15 | **RBAC Management UI** | Team Access permissions interface with R/W/C controls | Sprint Week 4 (May 4-8) |

### Testing Milestones

| Milestone | Status | What It Means |
|-----------|--------|---------------|
| **Alpha Testing** | **Complete** | All core modules functional. Internal team tested full workflows end-to-end. Major bugs (date off-by-one, photo persistence) fixed. |
| **Beta Testing** | **Ready Now** | Feature-complete for core workflows. File uploads working, PWA installable, search functional, email notifications active. Ready for client/field testers. |
| **Production Release** | Target: After Beta feedback cycle | All Beta feedback addressed, AI Assistant (RailBot) fully integrated, demo artifacts removed, custom domain deployed. |

### Pre-Production Cleanup

The following items will be removed or replaced before the production release:

| Item | Current State | Production State |
|------|--------------|-----------------|
| **Demo User Switcher** | Dropdown in top-right menu allows switching between 10 demo users to test RBAC | Removed -- user identity determined by Supabase authentication |
| **Seed Data** | In-memory store with pre-populated demo data (projects, submittals, RFIs, etc.) | Replaced with live Supabase database |

---

*Product: RailCommand -- by A5 Rail | Developer: Dillan Milosevich, CTO -- Creative Currents LLC*
*Last updated: April 14, 2026 -- QC/QA Reports + Project Documents complete (Phase 12 Week 3 started)*
