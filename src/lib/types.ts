// Organization
export interface Organization {
  id: string;
  name: string;
  type: 'contractor' | 'engineer' | 'owner' | 'inspector';
  created_at: string;
}

// User Profile
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  organization_id: string;
  organization?: Organization;
  avatar_url: string;
  created_at: string;
}

// Project
export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  start_date: string;
  target_end_date: string;
  actual_end_date: string | null;
  budget_total: number;
  budget_spent: number;
  location: string;
  client: string;
  created_by: string;
  created_at: string;
}

// Project Member
export interface ProjectMember {
  id: string;
  project_id: string;
  profile_id: string;
  profile?: Profile;
  project_role: 'engineer' | 'contractor' | 'owner' | 'inspector' | 'manager' | 'superintendent' | 'foreman';
  can_edit: boolean;
  added_at: string;
}

// Submittal
export interface Submittal {
  id: string;
  project_id: string;
  number: string; // e.g. "SUB-001"
  title: string;
  description: string;
  spec_section: string; // e.g. "34 11 13 - Track Construction"
  status: SubmittalStatus;
  submitted_by: string;
  submitted_by_profile?: Profile;
  reviewed_by: string | null;
  reviewed_by_profile?: Profile;
  submit_date: string;
  due_date: string;
  review_date: string | null;
  review_notes: string | null;
  milestone_id: string | null;
  attachments?: Attachment[];
  created_at: string;
}

export type SubmittalStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'conditional' | 'rejected';

// RFI
export interface RFI {
  id: string;
  project_id: string;
  number: string; // e.g. "RFI-001"
  subject: string;
  question: string;
  answer: string | null;
  status: RFIStatus;
  priority: Priority;
  submitted_by: string;
  submitted_by_profile?: Profile;
  assigned_to: string;
  assigned_to_profile?: Profile;
  submit_date: string;
  due_date: string;
  response_date: string | null;
  milestone_id: string | null;
  responses?: RFIResponse[];
  attachments?: Attachment[];
  created_at: string;
}

export type RFIStatus = 'open' | 'answered' | 'closed' | 'overdue';

export interface RFIResponse {
  id: string;
  rfi_id: string;
  author_id: string;
  author?: Profile;
  content: string;
  is_official_response: boolean;
  created_at: string;
}

// Daily Log
export interface DailyLog {
  id: string;
  project_id: string;
  log_date: string;
  created_by: string;
  created_by_profile?: Profile;
  weather_temp: number;
  weather_conditions: string;
  weather_wind: string;
  work_summary: string;
  safety_notes: string;
  geo_tag: GeoTag | null;
  personnel: DailyLogPersonnel[];
  equipment: DailyLogEquipment[];
  work_items: DailyLogWorkItem[];
  attachments?: Attachment[];
  created_at: string;
}

export interface DailyLogPersonnel {
  id: string;
  daily_log_id: string;
  role: string;
  headcount: number;
  company: string;
}

export interface DailyLogEquipment {
  id: string;
  daily_log_id: string;
  equipment_type: string;
  count: number;
  notes: string;
}

export interface DailyLogWorkItem {
  id: string;
  daily_log_id: string;
  description: string;
  quantity: number;
  unit: string;
  location: string;
}

// Punch List Item
export interface PunchListItem {
  id: string;
  project_id: string;
  number: string; // e.g. "PL-001"
  title: string;
  description: string;
  location: string;
  geo_tag: GeoTag | null;
  status: PunchListStatus;
  priority: Priority;
  assigned_to: string;
  assigned_to_profile?: Profile;
  created_by: string;
  created_by_profile?: Profile;
  due_date: string;
  resolved_date: string | null;
  verified_date: string | null;
  resolution_notes: string | null;
  attachments?: Attachment[];
  created_at: string;
}

export type PunchListStatus = 'open' | 'in_progress' | 'resolved' | 'verified';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

// Milestone
export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string;
  target_date: string;
  actual_date: string | null;
  status: MilestoneStatus;
  percent_complete: number;
  budget_planned: number;
  budget_actual: number;
  sort_order: number;
  linked_submittals?: string[]; // submittal IDs
  linked_rfis?: string[]; // RFI IDs
  created_at: string;
}

export type MilestoneStatus = 'on_track' | 'at_risk' | 'behind' | 'complete' | 'not_started';

// Attachment
export type PhotoCategory = 'standard' | 'thermal' | 'document';

export interface Attachment {
  id: string;
  entity_type: 'submittal' | 'rfi' | 'daily_log' | 'punch_list';
  entity_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  photo_category: PhotoCategory;
  uploaded_by: string;
  geo_lat: number | null;
  geo_lng: number | null;
  captured_at: string | null;
  created_at: string;
}

// Geo-tag for jobs and work items
export interface GeoTag {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number;
  timestamp: string;
}

// Activity Log
export interface ActivityLogEntry {
  id: string;
  project_id: string;
  entity_type: 'submittal' | 'rfi' | 'daily_log' | 'punch_list' | 'milestone' | 'project';
  entity_id: string;
  action: 'created' | 'updated' | 'status_changed' | 'commented' | 'approved' | 'rejected' | 'submitted' | 'assigned';
  description: string;
  performed_by: string;
  performed_by_profile?: Profile;
  created_at: string;
}

// Dashboard KPI
export interface DashboardKPI {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: string;
  color?: string;
}

// Filter types for list views
export interface ListFilters {
  search: string;
  status: string[];
  priority: string[];
  assignee: string[];
  dateRange?: { from: string; to: string };
}
