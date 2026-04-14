/**
 * In-memory data store that wraps seed data and provides mutable CRUD operations.
 * Data persists across client-side navigations within a session.
 * Resets to seed data on full page reload.
 *
 * All getters accept an optional projectId to filter data by project.
 * All add* functions require a projectId to ensure data isolation.
 */
import {
  seedSubmittals,
  seedRFIs,
  seedDailyLogs,
  seedPunchListItems,
  seedProjectMembers,
  seedActivityLog,
  seedProfiles,
  seedOrganizations,
  seedMilestones,
  seedChangeOrders,
  seedWeeklyReports,
  seedModifications,
  seedQCQAReports,
  seedProjectDocuments,
  seedProject,
} from './seed-data';
import { getLocalDateString, getLocalDateStringOffset } from './date-utils';
import type {
  Organization,
  Profile,
  Project,
  ProjectInvitation,
  Submittal,
  RFI,
  RFIResponse,
  DailyLog,
  PunchListItem,
  Milestone,
  ChangeOrder,
  ChangeOrderStatus,
  ProjectMember,
  ActivityLogEntry,
  Attachment,
  GeoTag,
  PhotoCategory,
  SubmittalStatus,
  RFIStatus,
  PunchListStatus,
  MilestoneStatus,
  WeeklyReport,
  WeeklyReportStatus,
  WeeklyReportType,
  Modification,
  ModificationType,
  ModificationStatus,
  QCQAReport,
  QCQAReportType,
  QCQAReportStatus,
  ProjectDocument,
  DocumentCategory,
  DocumentStatus,
} from './types';

// Mutable copies of seed data
let projects: Project[] = [{ ...seedProject }];
let submittals: Submittal[] = [...seedSubmittals];
let rfis: RFI[] = [...seedRFIs];
let dailyLogs: DailyLog[] = [...seedDailyLogs];
let punchListItems: PunchListItem[] = [...seedPunchListItems];
let projectMembers: ProjectMember[] = [...seedProjectMembers];
let activityLog: ActivityLogEntry[] = [...seedActivityLog];
let milestones: Milestone[] = [...seedMilestones];
let changeOrders: ChangeOrder[] = [...seedChangeOrders];
let weeklyReports: WeeklyReport[] = [...seedWeeklyReports];
let modifications: Modification[] = [...seedModifications];
let qcqaReports: QCQAReport[] = [...seedQCQAReports];
let projectDocuments: ProjectDocument[] = [...seedProjectDocuments];

// --- Demo / Fresh mode ---
let demoMode = true;

export function isDemoMode(): boolean { return demoMode; }

/** Reset all data to seed (demo) state */
export function initDemoData(): void {
  demoMode = true;
  projects = [{ ...seedProject }];
  submittals = [...seedSubmittals];
  rfis = [...seedRFIs];
  dailyLogs = [...seedDailyLogs];
  punchListItems = [...seedPunchListItems];
  projectMembers = [...seedProjectMembers];
  activityLog = [...seedActivityLog];
  milestones = [...seedMilestones];
  changeOrders = [...seedChangeOrders];
  weeklyReports = [...seedWeeklyReports];
  modifications = [...seedModifications];
  qcqaReports = [...seedQCQAReports];
  projectDocuments = [...seedProjectDocuments];
  profiles = [...seedProfiles];
  organizations = [...seedOrganizations];
  attachments = [];
  invitations = [];
  currentUserId = 'prof-001';
  projectCounter = projects.length;
  submittalCounter = submittals.length;
  rfiCounter = rfis.length;
  dailyLogCounter = dailyLogs.length;
  punchListCounter = punchListItems.length;
  memberCounter = projectMembers.length;
  activityCounter = activityLog.length;
  profileCounter = profiles.length;
  orgCounter = organizations.length;
  changeOrderCounter = changeOrders.length;
  weeklyReportCounter = weeklyReports.length;
  modificationCounter = modifications.length;
  qcqaReportCounter = qcqaReports.length;
  documentCounter = projectDocuments.length;
  responseCounter = 0;
  attachmentCounter = 0;
  invitationCounter = 0;
}

/** Clear all data for a fresh sign-up */
export function initFreshData(name: string, email: string): string {
  demoMode = false;
  projects = [];
  submittals = [];
  rfis = [];
  dailyLogs = [];
  punchListItems = [];
  projectMembers = [];
  activityLog = [];
  milestones = [];
  changeOrders = [];
  weeklyReports = [];
  modifications = [];
  qcqaReports = [];
  projectDocuments = [];
  attachments = [];
  invitations = [];

  // Create a fresh org and profile for the new user
  organizations = [{ id: 'org-001', name: 'My Organization', type: 'contractor', tier: 'free', created_at: new Date().toISOString() }];
  const freshProfile: Profile = {
    id: 'prof-001',
    full_name: name,
    email,
    phone: '',
    role: 'admin',
    organization_id: 'org-001',
    avatar_url: '',
    created_at: new Date().toISOString(),
  };
  profiles = [freshProfile];

  currentUserId = freshProfile.id;
  projectCounter = 0;
  submittalCounter = 0;
  rfiCounter = 0;
  dailyLogCounter = 0;
  punchListCounter = 0;
  memberCounter = 0;
  activityCounter = 0;
  profileCounter = 1;
  orgCounter = 1;
  responseCounter = 0;
  changeOrderCounter = 0;
  weeklyReportCounter = 0;
  modificationCounter = 0;
  qcqaReportCounter = 0;
  documentCounter = 0;
  attachmentCounter = 0;
  invitationCounter = 0;

  return freshProfile.id;
}

// --- Current user (switchable for demo) ---
let currentUserId = 'prof-001';
export function getCurrentUserId(): string { return currentUserId; }
export function setCurrentUserId(id: string): void { currentUserId = id; }
export function getCurrentMembership(projectId: string): ProjectMember | undefined {
  return projectMembers.find((m) => m.project_id === projectId && m.profile_id === currentUserId);
}

// --- Counters for generating IDs and numbers ---
let projectCounter = projects.length;
let submittalCounter = submittals.length;
let rfiCounter = rfis.length;
let dailyLogCounter = dailyLogs.length;
let punchListCounter = punchListItems.length;
let memberCounter = projectMembers.length;
let activityCounter = activityLog.length;

// --- Project operations ---
export function getProjects(): Project[] { return projects; }
export function getProjectById(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export function addProject(data: {
  name: string;
  description: string;
  location: string;
  client: string;
  start_date: string;
  target_end_date: string;
  budget_total: number;
}): Project {
  projectCounter++;
  const num = String(projectCounter).padStart(3, '0');
  // Get the current user's organization
  const creatorProfile = profiles.find((p) => p.id === getCurrentUserId());
  const newProject: Project = {
    id: `proj-${num}`,
    organization_id: creatorProfile?.organization_id ?? 'org-001',
    name: data.name,
    description: data.description,
    status: 'active',
    start_date: data.start_date,
    target_end_date: data.target_end_date,
    actual_end_date: null,
    budget_total: data.budget_total,
    budget_spent: 0,
    location: data.location,
    client: data.client,
    created_by: getCurrentUserId(),
    created_at: new Date().toISOString(),
  };
  projects = [...projects, newProject];

  // Auto-add the creator as a project member with manager role
  addProjectMember(newProject.id, getCurrentUserId(), 'Project Manager');

  addActivity(newProject.id, 'project', newProject.id, 'created', `created project ${newProject.name}`);

  return newProject;
}

// --- Getters (project-filtered) ---
export function getSubmittals(projectId?: string) {
  if (!projectId) return submittals;
  return submittals.filter((s) => s.project_id === projectId);
}
export function getRFIs(projectId?: string) {
  if (!projectId) return rfis;
  return rfis.filter((r) => r.project_id === projectId);
}
export function getDailyLogs(projectId?: string) {
  if (!projectId) return dailyLogs;
  return dailyLogs.filter((d) => d.project_id === projectId);
}
export function getPunchListItems(projectId?: string) {
  if (!projectId) return punchListItems;
  return punchListItems.filter((p) => p.project_id === projectId);
}
export function getProjectMembers(projectId?: string) {
  if (!projectId) return projectMembers;
  return projectMembers.filter((m) => m.project_id === projectId);
}
export function getActivityLog(projectId?: string) {
  if (!projectId) return activityLog;
  return activityLog.filter((a) => a.project_id === projectId);
}
export function getMilestones(projectId?: string) {
  if (!projectId) return milestones;
  return milestones.filter((m) => m.project_id === projectId);
}
export function getChangeOrders(projectId?: string) {
  if (!projectId) return changeOrders;
  return changeOrders.filter((co) => co.project_id === projectId);
}

// Mutable profiles and organizations
let profiles: Profile[] = [...seedProfiles];
let organizations: Organization[] = [...seedOrganizations];
let profileCounter = profiles.length;
let orgCounter = organizations.length;

// Re-export seed data reference for backward compat
export { seedProject };

// Profile / Organization getters
export function getProfiles(): Profile[] { return profiles; }
export function getOrganizations(): Organization[] { return organizations; }

// Updated getProfileWithOrg that uses mutable data
export function getProfileWithOrg(profileId: string): (Profile & { organization: Organization }) | null {
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return null;
  const org = organizations.find((o) => o.id === profile.organization_id);
  if (!org) return null;
  return { ...profile, organization: org };
}

// --- Submittal operations ---
export function addSubmittal(projectId: string, data: {
  title: string;
  description: string;
  spec_section: string;
  milestone_id: string | null;
}): Submittal {
  submittalCounter++;
  const num = String(submittalCounter).padStart(3, '0');
  const newSubmittal: Submittal = {
    id: `sub-${num}`,
    project_id: projectId,
    number: `SUB-${num}`,
    title: data.title,
    description: data.description,
    spec_section: data.spec_section,
    status: 'submitted',
    submitted_by: getCurrentUserId(),
    reviewed_by: null,
    submit_date: new Date().toISOString(),
    due_date: getLocalDateStringOffset(14),
    review_date: null,
    review_notes: null,
    milestone_id: data.milestone_id,
    created_at: new Date().toISOString(),
  };
  submittals = [newSubmittal, ...submittals];
  addActivity(projectId, 'submittal', newSubmittal.id, 'created', `submitted ${newSubmittal.number}: ${newSubmittal.title}`);
  return newSubmittal;
}

export function updateSubmittalStatus(id: string, status: SubmittalStatus): void {
  submittals = submittals.map((s) =>
    s.id === id
      ? {
          ...s,
          status,
          review_date: ['approved', 'conditional', 'rejected'].includes(status) ? new Date().toISOString() : s.review_date,
          reviewed_by: ['approved', 'conditional', 'rejected'].includes(status) ? getCurrentUserId() : s.reviewed_by,
        }
      : s
  );
  const sub = submittals.find((s) => s.id === id);
  if (sub) addActivity(sub.project_id, 'submittal', id, 'status_changed', `changed ${sub.number} status to ${status}`);
}

// --- RFI operations ---
export function addRFI(projectId: string, data: {
  subject: string;
  question: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assigned_to: string;
  due_date: string;
  milestone_id: string | null;
}): RFI {
  rfiCounter++;
  const num = String(rfiCounter).padStart(3, '0');
  const newRFI: RFI = {
    id: `rfi-${num}`,
    project_id: projectId,
    number: `RFI-${num}`,
    subject: data.subject,
    question: data.question,
    answer: null,
    status: 'open',
    priority: data.priority,
    submitted_by: getCurrentUserId(),
    assigned_to: data.assigned_to || 'prof-002',
    submit_date: new Date().toISOString(),
    due_date: data.due_date || getLocalDateStringOffset(14),
    response_date: null,
    milestone_id: data.milestone_id,
    responses: [],
    created_at: new Date().toISOString(),
  };
  rfis = [newRFI, ...rfis];
  addActivity(projectId, 'rfi', newRFI.id, 'created', `created ${newRFI.number}: ${newRFI.subject}`);
  return newRFI;
}

export function updateRFIStatus(id: string, status: RFIStatus): void {
  rfis = rfis.map((r) =>
    r.id === id
      ? { ...r, status, response_date: status === 'answered' || status === 'closed' ? new Date().toISOString() : r.response_date }
      : r
  );
  const rfi = rfis.find((r) => r.id === id);
  if (rfi) addActivity(rfi.project_id, 'rfi', id, 'status_changed', `changed ${rfi.number} status to ${status}`);
}

export function addRFIResponse(rfiId: string, content: string): void {
  rfis = rfis.map((r) => {
    if (r.id !== rfiId) return r;
    const resp: RFIResponse = {
      id: `resp-${String(++responseCounter).padStart(3, '0')}`,
      rfi_id: rfiId,
      author_id: getCurrentUserId(),
      content,
      is_official_response: false,
      created_at: new Date().toISOString(),
    };
    return { ...r, responses: [...(r.responses ?? []), resp] };
  });
  const rfi = rfis.find((r) => r.id === rfiId);
  if (rfi) addActivity(rfi.project_id, 'rfi', rfiId, 'commented', `responded to ${rfi.number}`);
}

// --- Daily Log operations ---
export function addDailyLog(projectId: string, data: {
  log_date: string;
  weather_temp: number;
  weather_conditions: string;
  weather_wind: string;
  work_summary: string;
  safety_notes: string;
  geo_tag?: GeoTag | null;
  personnel: { role: string; headcount: number; company: string }[];
  equipment: { type: string; count: number; notes: string }[];
  work_items: { description: string; quantity: number; unit: string; location: string }[];
}): DailyLog {
  dailyLogCounter++;
  const num = String(dailyLogCounter).padStart(3, '0');
  const newLog: DailyLog = {
    id: `dl-${num}`,
    project_id: projectId,
    log_date: data.log_date,
    created_by: getCurrentUserId(),
    weather_temp: data.weather_temp,
    weather_conditions: data.weather_conditions,
    weather_wind: data.weather_wind,
    work_summary: data.work_summary,
    safety_notes: data.safety_notes,
    geo_tag: data.geo_tag ?? null,
    personnel: data.personnel.filter(p => p.role).map((p, i) => ({
      id: `dlp-${num}-${i}`,
      daily_log_id: `dl-${num}`,
      role: p.role,
      headcount: p.headcount,
      company: p.company,
    })),
    equipment: data.equipment.filter(e => e.type).map((e, i) => ({
      id: `dle-${num}-${i}`,
      daily_log_id: `dl-${num}`,
      equipment_type: e.type,
      count: e.count,
      notes: e.notes,
    })),
    work_items: data.work_items.filter(w => w.description).map((w, i) => ({
      id: `dlw-${num}-${i}`,
      daily_log_id: `dl-${num}`,
      description: w.description,
      quantity: w.quantity,
      unit: w.unit,
      location: w.location,
    })),
    created_at: new Date().toISOString(),
  };
  dailyLogs = [newLog, ...dailyLogs];
  addActivity(projectId, 'daily_log', newLog.id, 'created', `created daily log for ${data.log_date}`);
  return newLog;
}

export function updateDailyLog(logId: string, data: {
  log_date: string;
  weather_temp: number;
  weather_conditions: string;
  weather_wind: string;
  work_summary: string;
  safety_notes: string;
  geo_tag?: GeoTag | null;
  personnel: { role: string; headcount: number; company: string }[];
  equipment: { type: string; count: number; notes: string }[];
  work_items: { description: string; quantity: number; unit: string; location: string }[];
}): DailyLog | null {
  const idx = dailyLogs.findIndex((l) => l.id === logId);
  if (idx === -1) return null;
  const existing = dailyLogs[idx];
  const updated: DailyLog = {
    ...existing,
    log_date: data.log_date,
    weather_temp: data.weather_temp,
    weather_conditions: data.weather_conditions,
    weather_wind: data.weather_wind,
    work_summary: data.work_summary,
    safety_notes: data.safety_notes,
    geo_tag: data.geo_tag ?? null,
    personnel: data.personnel.filter(p => p.role).map((p, i) => ({
      id: `${existing.id}-p-${i}`,
      daily_log_id: existing.id,
      role: p.role,
      headcount: p.headcount,
      company: p.company,
    })),
    equipment: data.equipment.filter(e => e.type).map((e, i) => ({
      id: `${existing.id}-e-${i}`,
      daily_log_id: existing.id,
      equipment_type: e.type,
      count: e.count,
      notes: e.notes,
    })),
    work_items: data.work_items.filter(w => w.description).map((w, i) => ({
      id: `${existing.id}-w-${i}`,
      daily_log_id: existing.id,
      description: w.description,
      quantity: w.quantity,
      unit: w.unit,
      location: w.location,
    })),
  };
  dailyLogs[idx] = updated;
  addActivity(existing.project_id, 'daily_log', existing.id, 'updated', `updated daily log for ${data.log_date}`);
  return updated;
}

// --- Punch List operations ---
export function addPunchListItem(projectId: string, data: {
  title: string;
  description: string;
  location: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assigned_to: string;
  due_date: string;
  geo_tag?: GeoTag | null;
}): PunchListItem {
  punchListCounter++;
  const num = String(punchListCounter).padStart(3, '0');
  const newItem: PunchListItem = {
    id: `pl-${num}`,
    project_id: projectId,
    number: `PL-${num}`,
    title: data.title,
    description: data.description,
    location: data.location,
    geo_tag: data.geo_tag ?? null,
    status: 'open',
    priority: data.priority,
    assigned_to: data.assigned_to || getCurrentUserId(),
    created_by: getCurrentUserId(),
    due_date: data.due_date || getLocalDateStringOffset(14),
    resolved_date: null,
    verified_date: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
  };
  punchListItems = [newItem, ...punchListItems];
  addActivity(projectId, 'punch_list', newItem.id, 'created', `created ${newItem.number}: ${newItem.title}`);
  return newItem;
}

export function updatePunchListStatus(id: string, status: PunchListStatus, resolutionNotes?: string): void {
  punchListItems = punchListItems.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      status,
      resolution_notes: resolutionNotes !== undefined ? resolutionNotes : item.resolution_notes,
      resolved_date: status === 'resolved' ? new Date().toISOString() : item.resolved_date,
      verified_date: status === 'verified' ? new Date().toISOString() : item.verified_date,
    };
  });
  const pl = punchListItems.find((i) => i.id === id);
  if (pl) addActivity(pl.project_id, 'punch_list', id, 'status_changed', `changed ${pl.number} status to ${status}`);
}

export function updatePunchListItem(id: string, data: Partial<PunchListItem>): void {
  punchListItems = punchListItems.map((item) =>
    item.id === id ? { ...item, ...data } : item
  );
}

export function deletePunchListItem(id: string): void {
  punchListItems = punchListItems.filter((item) => item.id !== id);
  attachments = attachments.filter((a) => !(a.entity_type === 'punch_list' && a.entity_id === id));
}

export function updateSubmittal(id: string, data: Partial<Submittal>): void {
  submittals = submittals.map((s) =>
    s.id === id ? { ...s, ...data } : s
  );
}

export function deleteSubmittal(id: string): void {
  submittals = submittals.filter((s) => s.id !== id);
  attachments = attachments.filter((a) => !(a.entity_type === 'submittal' && a.entity_id === id));
}

export function updateRFI(id: string, data: Partial<RFI>): void {
  rfis = rfis.map((r) =>
    r.id === id ? { ...r, ...data } : r
  );
}

export function deleteRFI(id: string): void {
  rfis = rfis.filter((r) => r.id !== id);
  attachments = attachments.filter((a) => !(a.entity_type === 'rfi' && a.entity_id === id));
}

export function updateMilestone(id: string, data: Partial<Milestone>): void {
  milestones = milestones.map((m) =>
    m.id === id ? { ...m, ...data } : m
  );
}

export function addMilestone(projectId: string, data: {
  name: string;
  description: string;
  target_date: string;
  status?: MilestoneStatus;
  percent_complete?: number;
  budget_planned?: number;
  budget_actual?: number;
}): Milestone {
  const sortOrder = milestones.filter((m) => m.project_id === projectId).length + 1;
  const newMs: Milestone = {
    id: `ms-${Date.now()}`,
    project_id: projectId,
    name: data.name,
    description: data.description,
    target_date: data.target_date,
    actual_date: null,
    status: data.status ?? 'not_started',
    percent_complete: data.percent_complete ?? 0,
    budget_planned: data.budget_planned ?? 0,
    budget_actual: data.budget_actual ?? 0,
    sort_order: sortOrder,
    created_at: new Date().toISOString(),
  };
  milestones = [...milestones, newMs];
  addActivity(projectId, 'milestone', newMs.id, 'created', `created milestone: ${data.name}`);
  return newMs;
}

export function deleteMilestone(id: string): void {
  milestones = milestones.filter((m) => m.id !== id);
}

// --- Weekly Report operations ---
let weeklyReportCounter = weeklyReports.length;

export function getWeeklyReports(projectId?: string) {
  return projectId ? weeklyReports.filter(wr => wr.project_id === projectId) : weeklyReports;
}

export function getWeeklyReportById(id: string) {
  return weeklyReports.find(wr => wr.id === id) ?? null;
}

export function addWeeklyReport(projectId: string, data: {
  report_type: WeeklyReportType;
  week_start_date: string;
  week_end_date: string;
  title: string;
  work_summary: string;
  safety_summary: string;
  schedule_summary: string;
  issues_concerns: string;
  upcoming_work: string;
  weather_summary: string;
  manpower_total: number;
  equipment_hours: number;
}): WeeklyReport {
  weeklyReportCounter++;
  const num = String(weeklyReportCounter).padStart(3, '0');
  const newReport: WeeklyReport = {
    id: `wr-${Date.now()}`,
    project_id: projectId,
    number: `WR-${num}`,
    report_type: data.report_type,
    week_start_date: data.week_start_date,
    week_end_date: data.week_end_date,
    title: data.title,
    status: 'draft',
    work_summary: data.work_summary,
    safety_summary: data.safety_summary,
    schedule_summary: data.schedule_summary,
    issues_concerns: data.issues_concerns,
    upcoming_work: data.upcoming_work,
    weather_summary: data.weather_summary,
    manpower_total: data.manpower_total,
    equipment_hours: data.equipment_hours,
    submitted_by: currentUserId,
    approved_by: null,
    submit_date: getLocalDateString(),
    approval_date: null,
    created_at: new Date().toISOString(),
  };
  weeklyReports = [newReport, ...weeklyReports];
  addActivity(projectId, 'project', newReport.id, 'created', `created weekly report: ${data.title}`);
  return newReport;
}

export function updateWeeklyReport(id: string, data: Partial<WeeklyReport>): void {
  weeklyReports = weeklyReports.map((wr) => wr.id === id ? { ...wr, ...data } : wr);
}

export function deleteWeeklyReport(id: string): void {
  weeklyReports = weeklyReports.filter((wr) => wr.id !== id);
}

// --- Change Order operations ---
let changeOrderCounter = changeOrders.length;

export function addChangeOrder(projectId: string, data: {
  title: string;
  description: string;
  reason: string;
  amount: number;
  linked_milestone_id?: string | null;
}): ChangeOrder {
  changeOrderCounter++;
  const number = `CO-${String(changeOrderCounter).padStart(3, '0')}`;
  const newCO: ChangeOrder = {
    id: `co-${Date.now()}`,
    project_id: projectId,
    number,
    title: data.title,
    description: data.description,
    reason: data.reason,
    amount: data.amount,
    status: 'draft',
    submitted_by: currentUserId,
    submitted_by_profile: profiles.find((p) => p.id === currentUserId),
    approved_by: null,
    linked_milestone_id: data.linked_milestone_id ?? null,
    submit_date: getLocalDateString(),
    approval_date: null,
    created_at: new Date().toISOString(),
  };
  changeOrders = [newCO, ...changeOrders];
  addActivity(projectId, 'project', newCO.id, 'created', `created change order ${number}: ${data.title}`);
  return newCO;
}

export function updateChangeOrder(id: string, data: Partial<ChangeOrder>): void {
  changeOrders = changeOrders.map((co) =>
    co.id === id ? { ...co, ...data } : co
  );
}

export function deleteChangeOrder(id: string): void {
  changeOrders = changeOrders.filter((co) => co.id !== id);
}

// --- Modification operations ---
let modificationCounter = modifications.length;

export function getModifications(projectId?: string) {
  if (!projectId) return modifications;
  return modifications.filter((m) => m.project_id === projectId);
}

export function getModificationById(id: string) {
  return modifications.find((m) => m.id === id) ?? null;
}

export function addModification(projectId: string, data: {
  title: string;
  description: string;
  modification_type: ModificationType;
  revision_number: string;
  affected_documents: string;
  linked_milestone_id?: string | null;
}): Modification {
  modificationCounter++;
  const num = String(modificationCounter).padStart(3, '0');
  const profile = getProfileWithOrg(getCurrentUserId());
  const newMod: Modification = {
    id: `mod-${num}`,
    project_id: projectId,
    number: `MOD-${num}`,
    title: data.title,
    description: data.description,
    modification_type: data.modification_type,
    status: 'draft',
    revision_number: data.revision_number,
    affected_documents: data.affected_documents,
    issued_by: getCurrentUserId(),
    issued_by_profile: profile ?? undefined,
    issued_date: getLocalDateString(),
    effective_date: null,
    acknowledged_by: null,
    acknowledged_date: null,
    linked_milestone_id: data.linked_milestone_id ?? null,
    created_at: new Date().toISOString(),
  };
  modifications = [...modifications, newMod];
  return newMod;
}

export function updateModification(id: string, data: Partial<Modification>): void {
  modifications = modifications.map((m) =>
    m.id === id ? { ...m, ...data } : m
  );
}

export function deleteModification(id: string): void {
  modifications = modifications.filter((m) => m.id !== id);
}

// --- QC/QA Report operations ---
let qcqaReportCounter = qcqaReports.length;

export function getQCQAReports(projectId?: string) {
  if (!projectId) return qcqaReports;
  return qcqaReports.filter((r) => r.project_id === projectId);
}

export function getQCQAReportById(id: string) {
  return qcqaReports.find((r) => r.id === id) ?? null;
}

export function addQCQAReport(projectId: string, data: {
  report_type: QCQAReportType;
  title: string;
  description?: string;
  spec_reference?: string;
  location?: string;
  severity?: 'minor' | 'major' | 'critical';
  findings?: string;
  corrective_action?: string;
  is_nonconformance?: boolean;
  linked_punch_list_ids?: string[];
}): QCQAReport {
  qcqaReportCounter++;
  const num = String(qcqaReportCounter).padStart(3, '0');
  const profile = getProfileWithOrg(getCurrentUserId());
  const newReport: QCQAReport = {
    id: `qc-${Date.now()}`,
    project_id: projectId,
    number: `QC-${num}`,
    report_type: data.report_type,
    title: data.title,
    description: data.description ?? '',
    spec_reference: data.spec_reference ?? '',
    location: data.location ?? '',
    status: 'draft',
    findings: data.findings ?? '',
    corrective_action: data.corrective_action ?? '',
    is_nonconformance: data.is_nonconformance ?? false,
    severity: data.severity ?? 'minor',
    inspector: getCurrentUserId(),
    inspector_profile: profile ?? undefined,
    linked_punch_list_ids: data.linked_punch_list_ids ?? [],
    closed_by: null,
    closed_date: null,
    created_at: new Date().toISOString(),
  };
  qcqaReports = [newReport, ...qcqaReports];
  addActivity(projectId, 'project', newReport.id, 'created', `created QC/QA report ${newReport.number}: ${data.title}`);
  return newReport;
}

export function updateQCQAReport(id: string, data: Partial<QCQAReport>): void {
  qcqaReports = qcqaReports.map((r) =>
    r.id === id ? { ...r, ...data } : r
  );
}

export function deleteQCQAReport(id: string): void {
  qcqaReports = qcqaReports.filter((r) => r.id !== id);
}

// --- Project Document operations ---
let documentCounter = projectDocuments.length;

export function getProjectDocuments(projectId?: string) {
  if (!projectId) return projectDocuments;
  return projectDocuments.filter((d) => d.project_id === projectId);
}

export function getProjectDocumentById(id: string) {
  return projectDocuments.find((d) => d.id === id) ?? null;
}

export function addProjectDocument(projectId: string, data: {
  title: string;
  category: DocumentCategory;
  description?: string;
  revision?: string;
  revision_date?: string;
  file_name?: string;
  file_url?: string;
  file_size?: number;
  linked_milestone_id?: string | null;
}): ProjectDocument {
  documentCounter++;
  const num = String(documentCounter).padStart(3, '0');
  const profile = getProfileWithOrg(getCurrentUserId());
  const newDoc: ProjectDocument = {
    id: `doc-${num}`,
    project_id: projectId,
    number: `DOC-${num}`,
    title: data.title,
    description: data.description ?? '',
    category: data.category,
    status: 'draft',
    revision: data.revision ?? 'Rev 0',
    revision_date: data.revision_date ?? getLocalDateString(),
    file_name: data.file_name ?? '',
    file_url: data.file_url ?? '',
    file_size: data.file_size ?? 0,
    uploaded_by: getCurrentUserId(),
    uploaded_by_profile: profile ? { id: profile.id, full_name: profile.full_name } : undefined,
    reviewed_by: null,
    review_date: null,
    linked_milestone_id: data.linked_milestone_id ?? null,
    created_at: new Date().toISOString(),
  };
  projectDocuments = [newDoc, ...projectDocuments];
  addActivity(projectId, 'project', newDoc.id, 'created', `uploaded ${newDoc.number}: ${data.title}`);
  return newDoc;
}

export function updateProjectDocument(id: string, data: Partial<ProjectDocument>): void {
  projectDocuments = projectDocuments.map((d) => {
    if (d.id !== id) return d;
    const updated = { ...d, ...data };
    // Auto-set reviewed_by and review_date on approval
    if (data.status === 'approved') {
      updated.reviewed_by = getCurrentUserId();
      updated.review_date = getLocalDateString();
      const profile = getProfileWithOrg(getCurrentUserId());
      if (profile) {
        updated.reviewed_by_profile = { id: profile.id, full_name: profile.full_name };
      }
    }
    return updated;
  });
}

export function deleteProjectDocument(id: string): void {
  projectDocuments = projectDocuments.filter((d) => d.id !== id);
}

// --- Team operations ---
export function addProjectMember(projectId: string, profileId: string, role: string): ProjectMember {
  memberCounter++;
  const num = String(memberCounter).padStart(3, '0');
  const newMember: ProjectMember = {
    id: `pm-${num}`,
    project_id: projectId,
    profile_id: profileId,
    project_role: role as ProjectMember['project_role'],
    can_edit: true,
    added_at: new Date().toISOString(),
  };
  projectMembers = [...projectMembers, newMember];
  return newMember;
}

export function removeProjectMember(id: string): void {
  projectMembers = projectMembers.filter((m) => m.id !== id);
}

// --- Project editing ---
export function updateProject(
  id: string,
  data: Partial<Pick<Project, 'name' | 'description' | 'location' | 'client' | 'start_date' | 'target_end_date' | 'budget_total' | 'turnover_date' | 'substantial_completion_date' | 'project_completion_date'>>
): Project | null {
  let updated: Project | null = null;
  projects = projects.map((p) => {
    if (p.id === id) {
      updated = { ...p, ...data };
      return updated;
    }
    return p;
  });
  if (updated) {
    addActivity(id, 'project', id, 'updated', 'updated project details');
  }
  return updated;
}

// --- Project lifecycle ---
export function updateProjectStatus(id: string, status: Project['status']): void {
  projects = projects.map((p) =>
    p.id === id
      ? {
          ...p,
          status,
          actual_end_date: status === 'completed' ? getLocalDateString() : p.actual_end_date,
        }
      : p
  );
  addActivity(id, 'project', id, 'status_changed', `project marked as ${status.replace('_', ' ')}`);
}

export function deleteProject(id: string): void {
  // Collect entity IDs to clean up orphaned attachments
  const deletedEntityIds = new Set<string>([
    ...submittals.filter((s) => s.project_id === id).map((s) => s.id),
    ...rfis.filter((r) => r.project_id === id).map((r) => r.id),
    ...dailyLogs.filter((d) => d.project_id === id).map((d) => d.id),
    ...punchListItems.filter((p) => p.project_id === id).map((p) => p.id),
  ]);
  projects = projects.filter((p) => p.id !== id);
  submittals = submittals.filter((s) => s.project_id !== id);
  rfis = rfis.filter((r) => r.project_id !== id);
  dailyLogs = dailyLogs.filter((d) => d.project_id !== id);
  punchListItems = punchListItems.filter((p) => p.project_id !== id);
  projectMembers = projectMembers.filter((m) => m.project_id !== id);
  activityLog = activityLog.filter((a) => a.project_id !== id);
  milestones = milestones.filter((m) => m.project_id !== id);
  attachments = attachments.filter((a) => !deletedEntityIds.has(a.entity_id));
}

// --- Profile / Organization creation ---
export function updateProfile(profileId: string, data: { full_name?: string; phone?: string; avatar_url?: string }): void {
  profiles = profiles.map((p) =>
    p.id === profileId ? { ...p, ...data } : p
  );
}

export function addProfile(data: {
  full_name: string;
  email: string;
  phone: string;
  role: Profile['role'];
  organization_id: string;
}): Profile {
  profileCounter++;
  const num = String(profileCounter).padStart(3, '0');
  const newProfile: Profile = {
    id: `prof-${num}`,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    organization_id: data.organization_id,
    avatar_url: '',
    created_at: new Date().toISOString(),
  };
  profiles = [...profiles, newProfile];
  return newProfile;
}

export function addOrganization(data: {
  name: string;
  type: Organization['type'];
}): Organization {
  orgCounter++;
  const num = String(orgCounter).padStart(3, '0');
  const newOrg: Organization = {
    id: `org-${num}`,
    name: data.name,
    type: data.type,
    tier: 'free',
    created_at: new Date().toISOString(),
  };
  organizations = [...organizations, newOrg];
  return newOrg;
}

// --- Invitation operations ---
let invitations: ProjectInvitation[] = [];
let invitationCounter = 0;

export function getProjectInvitations(projectId: string): ProjectInvitation[] {
  return invitations.filter((i) => i.project_id === projectId);
}

export function getUserInvitations(email: string): ProjectInvitation[] {
  return invitations.filter(
    (i) => i.email === email && i.status === 'pending' && new Date(i.expires_at) > new Date()
  );
}

export function addInvitation(data: {
  project_id: string;
  email: string;
  project_role: ProjectMember['project_role'];
}): ProjectInvitation {
  invitationCounter++;
  const num = String(invitationCounter).padStart(3, '0');
  const project = projects.find((p) => p.id === data.project_id);
  const inviterProfile = profiles.find((p) => p.id === getCurrentUserId());
  const invitation: ProjectInvitation = {
    id: `inv-${num}`,
    project_id: data.project_id,
    project: project ? { id: project.id, name: project.name } : undefined,
    email: data.email,
    project_role: data.project_role,
    invited_by: getCurrentUserId(),
    invited_by_profile: inviterProfile ? { id: inviterProfile.id, full_name: inviterProfile.full_name } : undefined,
    status: 'pending',
    token: `demo-token-${num}`,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
  invitations = [...invitations, invitation];
  return invitation;
}

export function updateInvitationStatus(id: string, status: ProjectInvitation['status']): void {
  invitations = invitations.map((i) => (i.id === id ? { ...i, status } : i));
}

// --- Attachment operations ---
let attachments: Attachment[] = [];
let responseCounter = 0;
let attachmentCounter = 0;

export function getAttachments(entityType: Attachment['entity_type'], entityId: string): Attachment[] {
  return attachments.filter((a) => a.entity_type === entityType && a.entity_id === entityId);
}

export function addAttachment(data: {
  entity_type: Attachment['entity_type'];
  entity_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  photo_category?: PhotoCategory;
  geo_lat?: number | null;
  geo_lng?: number | null;
}): Attachment {
  attachmentCounter++;
  const newAttachment: Attachment = {
    id: `att-${String(attachmentCounter).padStart(3, '0')}`,
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    file_name: data.file_name,
    file_url: data.file_url,
    file_type: data.file_type,
    file_size: data.file_size,
    photo_category: data.photo_category ?? 'document',
    uploaded_by: getCurrentUserId(),
    geo_lat: data.geo_lat ?? null,
    geo_lng: data.geo_lng ?? null,
    captured_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  attachments = [...attachments, newAttachment];
  return newAttachment;
}

export function removeAttachment(id: string): void {
  attachments = attachments.filter((a) => a.id !== id);
}

// --- Activity Log ---
function addActivity(
  projectId: string,
  entity_type: ActivityLogEntry['entity_type'],
  entity_id: string,
  action: ActivityLogEntry['action'],
  description: string
): void {
  activityCounter++;
  activityLog = [
    {
      id: `act-${activityCounter}`,
      project_id: projectId,
      entity_type,
      entity_id,
      action,
      description,
      performed_by: getCurrentUserId(),
      created_at: new Date().toISOString(),
    },
    ...activityLog,
  ];
}
