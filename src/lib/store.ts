/**
 * In-memory data store that wraps seed data and provides mutable CRUD operations.
 * Data persists across client-side navigations within a session.
 * Resets to seed data on full page reload.
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
  Submittal,
  RFI,
  RFIResponse,
  DailyLog,
  PunchListItem,
  ProjectMember,
  ActivityLogEntry,
  SubmittalStatus,
  RFIStatus,
  PunchListStatus,
} from './types';

// Mutable copies of seed data
let submittals: Submittal[] = [...seedSubmittals];
let rfis: RFI[] = [...seedRFIs];
let dailyLogs: DailyLog[] = [...seedDailyLogs];
let punchListItems: PunchListItem[] = [...seedPunchListItems];
let projectMembers: ProjectMember[] = [...seedProjectMembers];
let activityLog: ActivityLogEntry[] = [...seedActivityLog];

// --- Counters for generating IDs and numbers ---
let submittalCounter = submittals.length;
let rfiCounter = rfis.length;
let dailyLogCounter = dailyLogs.length;
let punchListCounter = punchListItems.length;
let memberCounter = projectMembers.length;
let activityCounter = activityLog.length;

// --- Getters ---
export function getSubmittals() { return submittals; }
export function getRFIs() { return rfis; }
export function getDailyLogs() { return dailyLogs; }
export function getPunchListItems() { return punchListItems; }
export function getProjectMembers() { return projectMembers; }
export function getActivityLog() { return activityLog; }

// Re-export read-only seed data that doesn't need mutation
export { seedProfiles, seedOrganizations, seedMilestones, seedProject };
export { getProfileWithOrg } from './seed-data';

// --- Submittal operations ---
export function addSubmittal(data: {
  title: string;
  description: string;
  spec_section: string;
  milestone_id: string | null;
}): Submittal {
  submittalCounter++;
  const num = String(submittalCounter).padStart(3, '0');
  const newSubmittal: Submittal = {
    id: `sub-${num}`,
    project_id: 'proj-001',
    number: `SUB-${num}`,
    title: data.title,
    description: data.description,
    spec_section: data.spec_section,
    status: 'submitted',
    submitted_by: 'prof-001',
    reviewed_by: null,
    submit_date: new Date().toISOString(),
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    review_date: null,
    review_notes: null,
    milestone_id: data.milestone_id,
    created_at: new Date().toISOString(),
  };
  submittals = [newSubmittal, ...submittals];
  addActivity('submittal', newSubmittal.id, 'created', `submitted ${newSubmittal.number}: ${newSubmittal.title}`);
  return newSubmittal;
}

export function updateSubmittalStatus(id: string, status: SubmittalStatus): void {
  submittals = submittals.map((s) =>
    s.id === id
      ? {
          ...s,
          status,
          review_date: ['approved', 'conditional', 'rejected'].includes(status) ? new Date().toISOString() : s.review_date,
          reviewed_by: ['approved', 'conditional', 'rejected'].includes(status) ? 'prof-001' : s.reviewed_by,
        }
      : s
  );
  const sub = submittals.find((s) => s.id === id);
  if (sub) addActivity('submittal', id, 'status_changed', `changed ${sub.number} status to ${status}`);
}

// --- RFI operations ---
export function addRFI(data: {
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
    project_id: 'proj-001',
    number: `RFI-${num}`,
    subject: data.subject,
    question: data.question,
    answer: null,
    status: 'open',
    priority: data.priority,
    submitted_by: 'prof-001',
    assigned_to: data.assigned_to || 'prof-002',
    submit_date: new Date().toISOString(),
    due_date: data.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    response_date: null,
    milestone_id: data.milestone_id,
    responses: [],
    created_at: new Date().toISOString(),
  };
  rfis = [newRFI, ...rfis];
  addActivity('rfi', newRFI.id, 'created', `created ${newRFI.number}: ${newRFI.subject}`);
  return newRFI;
}

export function updateRFIStatus(id: string, status: RFIStatus): void {
  rfis = rfis.map((r) =>
    r.id === id
      ? { ...r, status, response_date: status === 'answered' || status === 'closed' ? new Date().toISOString() : r.response_date }
      : r
  );
  const rfi = rfis.find((r) => r.id === id);
  if (rfi) addActivity('rfi', id, 'status_changed', `changed ${rfi.number} status to ${status}`);
}

export function addRFIResponse(rfiId: string, content: string): void {
  rfis = rfis.map((r) => {
    if (r.id !== rfiId) return r;
    const resp: RFIResponse = {
      id: `resp-${Date.now()}`,
      rfi_id: rfiId,
      author_id: 'prof-001',
      content,
      is_official_response: false,
      created_at: new Date().toISOString(),
    };
    return { ...r, responses: [...(r.responses ?? []), resp] };
  });
  const rfi = rfis.find((r) => r.id === rfiId);
  if (rfi) addActivity('rfi', rfiId, 'commented', `responded to ${rfi.number}`);
}

// --- Daily Log operations ---
export function addDailyLog(data: {
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
    project_id: 'proj-001',
    log_date: data.log_date,
    created_by: 'prof-001',
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
  addActivity('daily_log', newLog.id, 'created', `created daily log for ${data.log_date}`);
  return newLog;
}

// --- Punch List operations ---
export function addPunchListItem(data: {
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
    project_id: 'proj-001',
    number: `PL-${num}`,
    title: data.title,
    description: data.description,
    location: data.location,
    status: 'open',
    priority: data.priority,
    assigned_to: data.assigned_to || 'prof-001',
    created_by: 'prof-001',
    due_date: data.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    resolved_date: null,
    verified_date: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
  };
  punchListItems = [newItem, ...punchListItems];
  addActivity('punch_list', newItem.id, 'created', `created ${newItem.number}: ${newItem.title}`);
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
  if (pl) addActivity('punch_list', id, 'status_changed', `changed ${pl.number} status to ${status}`);
}

// --- Team operations ---
export function addProjectMember(profileId: string, role: string): ProjectMember {
  memberCounter++;
  const num = String(memberCounter).padStart(3, '0');
  const newMember: ProjectMember = {
    id: `pm-${num}`,
    project_id: 'proj-001',
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

// --- Activity Log ---
function addActivity(
  entity_type: ActivityLogEntry['entity_type'],
  entity_id: string,
  action: ActivityLogEntry['action'],
  description: string
): void {
  activityCounter++;
  activityLog = [
    {
      id: `act-${activityCounter}`,
      project_id: 'proj-001',
      entity_type,
      entity_id,
      action,
      description,
      performed_by: 'prof-001',
      created_at: new Date().toISOString(),
    },
    ...activityLog,
  ];
}
