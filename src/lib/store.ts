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
  seedProject,
} from './seed-data';
import type {
  Organization,
  Profile,
  Project,
  Submittal,
  RFI,
  RFIResponse,
  DailyLog,
  PunchListItem,
  Milestone,
  ProjectMember,
  ActivityLogEntry,
  SubmittalStatus,
  RFIStatus,
  PunchListStatus,
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
  const newProject: Project = {
    id: `proj-${num}`,
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
export function getProfileWithOrg(profileId: string): Profile & { organization: Organization } {
  const profile = profiles.find((p) => p.id === profileId)!;
  const org = organizations.find((o) => o.id === profile.organization_id)!;
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
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
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
    due_date: data.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
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
      id: `resp-${Date.now()}`,
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

// --- Punch List operations ---
export function addPunchListItem(projectId: string, data: {
  title: string;
  description: string;
  location: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assigned_to: string;
  due_date: string;
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
    status: 'open',
    priority: data.priority,
    assigned_to: data.assigned_to || getCurrentUserId(),
    created_by: getCurrentUserId(),
    due_date: data.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
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

// --- Project lifecycle ---
export function updateProjectStatus(id: string, status: Project['status']): void {
  projects = projects.map((p) =>
    p.id === id
      ? {
          ...p,
          status,
          actual_end_date: status === 'completed' ? new Date().toISOString().split('T')[0] : p.actual_end_date,
        }
      : p
  );
  addActivity(id, 'project', id, 'status_changed', `project marked as ${status.replace('_', ' ')}`);
}

export function deleteProject(id: string): void {
  projects = projects.filter((p) => p.id !== id);
  submittals = submittals.filter((s) => s.project_id !== id);
  rfis = rfis.filter((r) => r.project_id !== id);
  dailyLogs = dailyLogs.filter((d) => d.project_id !== id);
  punchListItems = punchListItems.filter((p) => p.project_id !== id);
  projectMembers = projectMembers.filter((m) => m.project_id !== id);
  activityLog = activityLog.filter((a) => a.project_id !== id);
  milestones = milestones.filter((m) => m.project_id !== id);
}

// --- Profile / Organization creation ---
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
    created_at: new Date().toISOString(),
  };
  organizations = [...organizations, newOrg];
  return newOrg;
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
