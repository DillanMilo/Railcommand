# RailCommand -- Feature Overview & Role-Based Access Guide

**Prepared for:** A5 Rail Leadership
**Date:** February 27, 2026
**Version:** 1.0

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
4. [Cross-Cutting Features](#4-cross-cutting-features)
5. [Permission Matrix (Complete Reference)](#5-permission-matrix-complete-reference)
6. [Roadmap / Planned Features](#6-roadmap--planned-features)

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

### 3.1 Dashboard

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

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View project KPIs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View budget/financial data | Yes | - | - | - | - | - | Yes |
| View activity feed | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Use quick actions | Yes | Yes | Yes | Yes | Yes | - | - |
| View milestones widget | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

---

### 3.2 Submittals Module

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

### 3.3 RFIs Module

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

### 3.4 Daily Logs Module

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
- **Daily Log Detail View** -- Read-only presentation of a completed log with all structured data sections
- **Photo Attachment Support** -- Upload site photos associated with the day's work
- **Searchable History** -- Find past logs by date, content, or personnel

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

### 3.5 Punch List Module

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

### 3.6 Schedule & Milestones

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

**Permissions by Role**

| Action | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner / Client |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View schedule/milestones | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Edit milestones | Yes | Yes | - | - | - | - | - |
| View budget data | Yes | - | - | - | - | - | Yes |
| View linked submittals/RFIs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View schedule health KPIs | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

> **Note:** Budget and financial data per milestone is hidden from Contractor, Foreman, and other field roles. Only Project Managers, Admins, and Owner/Client roles can view financial figures.

---

### 3.7 Team Management

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

### 3.8 Settings & Profile

**Overview**

Settings and Profile pages allow every user to manage their personal information, customize their experience, and control their notification preferences. Profile settings also display organization membership details and current project assignment.

**Key Features**

- **Profile Management:**
  - Edit full name and phone number
  - View email address (read-only; admin change required)
  - Avatar display with initials (photo upload coming soon)
  - View organization name, type, and membership date
  - View current project assignment and access level
- **Appearance Settings:**
  - **Light Mode** -- Clean, bright interface
  - **Dark Mode** -- Reduced-glare dark theme for low-light environments
  - **Auto Mode** -- Automatically switches to dark mode from 7 PM to 6 AM
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

## 4. Cross-Cutting Features

These capabilities span the entire application and are available across all modules.

### Authentication & Security

- **Email/Password Sign-In** -- Standard email and password authentication with form validation
- **Google OAuth** -- One-click sign-in with Google for faster access
- **Account Registration** -- Sign-up flow with password strength meter (Weak / Fair / Good / Strong)
- **Password Reset** -- Self-service forgot-password flow via email reset link
- **Row-Level Security** -- Database-level access control ensures users can only access data they are authorized to see
- **256-Bit Encryption** -- All data encrypted in transit and at rest
- **US Data Residency** -- All data stored exclusively within the United States
- **Session Management** -- View and manage active sessions across devices

### Progressive Web App (PWA)

- **Add to Home Screen** -- Install RailCommand on any device directly from the browser, no app store required
- **Device-Specific Instructions** -- Guided installation steps for iOS (Safari), Android (Chrome), and Desktop (Chrome/Edge)
- **Native-Like Experience** -- Runs in its own window without browser chrome once installed
- **Instant Access** -- Launch from your home screen or app drawer like any other app

### Dark Mode

- **Three Modes** -- Light, Dark, and Auto
- **Auto Mode** -- Intelligent scheduling that activates dark mode from 7 PM to 6 AM
- **System-Wide** -- Every screen, component, and module fully supports dark mode
- **Field-Friendly** -- Reduces glare and eye strain for outdoor and low-light field conditions

### Responsive Design

- **Mobile-First** -- Every screen designed for mobile viewports first, then enhanced for larger screens
- **Desktop Optimization** -- Full-width layouts, multi-column grids, and sidebar navigation on desktop
- **Bottom Navigation** -- Thumb-friendly tab bar for mobile navigation
- **Collapsible Sidebar** -- Desktop sidebar collapses to save space when needed
- **Touch Targets** -- Minimum 44px touch targets throughout for accessibility
- **Responsive Grids** -- KPI cards, team members, and list views adapt from 1 to 6 columns based on screen size

### Real-Time Notifications

- **In-App Notification Panel** -- Bell icon in the top bar with recent activity stream
- **Role-Filtered Activity** -- Activity feed shows items relevant to the user's role and assignments
- **Per-Module Toggles** -- Users can enable or disable notifications for each module independently

### Role-Based Access Control (RBAC) -- Implemented

RailCommand enforces role-based permissions across every module in the application. This is not just a design concept -- it is fully implemented in the current MVP frontend.

- **Permission Matrix Engine** -- A centralized permission module defines 12 distinct actions (create submittals, review submittals, create RFIs, respond to RFIs, close RFIs, create daily logs, create punch items, resolve punch items, verify punch items, manage team, manage project, view budget) mapped to all 7 project roles
- **Per-Page Enforcement** -- Every page in the app checks the current user's project role before rendering action buttons. Unauthorized actions are hidden entirely (not grayed out), keeping the interface clean and role-appropriate
- **URL Protection** -- Direct navigation to create/edit pages (e.g., typing `/submittals/new` in the browser) is also gated -- unauthorized users see an "Access Denied" message instead of the form
- **Budget Restriction** -- Financial data (budget KPI on dashboard, milestone budgets) is only visible to Project Managers, Superintendents, Engineers, and Owner/Client roles. Other roles see a "Restricted" placeholder
- **Quick Actions Filtering** -- Dashboard quick-action shortcuts dynamically show only the actions permitted for the current user's role
- **Project Management Gating** -- Sidebar actions (Mark Complete, Archive, Delete project) are only visible to users with the Project Manager role
- **Team Management Gating** -- Add/remove team member controls are restricted to Project Managers only

**MVP Demo Note:** The current MVP includes a **User Switcher** in the top-right dropdown menu. This development tool allows you to switch between all 10 seed users to demonstrate how the interface adapts to each role in real time. This switcher will be removed before production deployment -- in the shipped product, the user's role is determined automatically by their Supabase authentication credentials and project membership. The switcher exists solely for client demos and internal testing.

### Navigation & Usability

- **Global Search** -- Search across all modules from the top bar
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

> **Legend:** "Yes" = Permitted | "-" = Not Permitted | "Admin Only" = Requires organization-level Admin role

---

## 6. Roadmap / Planned Features

The following features are planned for future releases of RailCommand:

| Feature | Description | Status |
|---------|-------------|--------|
| **AI Assistant (RailBot)** | Natural language queries, guided data entry (create RFIs and punch items via conversation), project summarization, and daily log summaries -- powered by AI and accessible from any page via a slide-over chat panel. | In Development |
| **Photo & Document Management** | Photo upload (standard + thermal) with GPS geo-tagging on punch list items and daily logs. Photo gallery with lightbox viewer. Geo-tag capture for job-level location tracking. Backend storage via Supabase Storage buckets pending connection. | MVP UI Complete |
| **Custom Reporting & Export** | Generate custom reports across modules with PDF and CSV export. Filterable by date range, status, role, and more. | Planned |
| **Multi-Project Portfolio View** | A portfolio dashboard for leadership to monitor all active projects, compare KPIs, and allocate resources across projects. | Planned |
| **Offline Mode** | Full offline capability for field use -- create daily logs, punch items, and RFIs without connectivity, with automatic sync when back online. | Planned |
| **Email Digests & Scheduled Notifications** | Configurable daily or weekly email summaries of project activity, overdue items, and upcoming milestones. | Planned |

### Pre-Production Cleanup

The following items will be removed or replaced before the production release:

| Item | Current State | Production State |
|------|--------------|-----------------|
| **Demo User Switcher** | Dropdown in top-right menu allows switching between 10 demo users to test RBAC | Removed -- user identity determined by Supabase authentication |
| **Seed Data** | In-memory store with pre-populated demo data (projects, submittals, RFIs, etc.) | Replaced with live Supabase database |
| **Simulated Auth** | Form submission redirects to dashboard without real authentication | Full Supabase Auth with email/password and Google OAuth |
| **Simulated Save Actions** | Profile updates and settings changes use setTimeout to mimic API calls | Wired to Supabase server actions with real persistence |

---

*Product: RailCommand -- by A5 Rail | Developer: Creative Currents LLC*
