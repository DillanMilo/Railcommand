import { Organization, Profile, Project, ProjectMember, Submittal, RFI, RFIResponse, DailyLog, PunchListItem, Milestone, ActivityLogEntry } from './types';

// ============================================================
// ORGANIZATIONS
// ============================================================
export const seedOrganizations: Organization[] = [
  { id: 'org-001', name: 'A5 Rail', type: 'owner', created_at: '2025-01-15T00:00:00Z' },
  { id: 'org-002', name: 'Mountain West Track Services', type: 'contractor', created_at: '2025-02-01T00:00:00Z' },
  { id: 'org-003', name: 'Front Range Signal Co.', type: 'contractor', created_at: '2025-02-01T00:00:00Z' },
  { id: 'org-004', name: 'Summit Grade Construction', type: 'contractor', created_at: '2025-03-01T00:00:00Z' },
  { id: 'org-005', name: 'Colorado DOT', type: 'inspector', created_at: '2025-01-01T00:00:00Z' },
  { id: 'org-006', name: 'Kensington Engineering Group', type: 'engineer', created_at: '2025-01-10T00:00:00Z' },
];

// ============================================================
// PROFILES
// ============================================================
export const seedProfiles: Profile[] = [
  { id: 'prof-001', email: 'mark.sullivan@a5rail.com', full_name: 'Mark Sullivan', phone: '(303) 555-0101', role: 'admin', organization_id: 'org-001', avatar_url: '', created_at: '2025-01-15T00:00:00Z' },
  { id: 'prof-002', email: 'jessica.chen@a5rail.com', full_name: 'Jessica Chen', phone: '(303) 555-0102', role: 'manager', organization_id: 'org-001', avatar_url: '', created_at: '2025-01-15T00:00:00Z' },
  { id: 'prof-003', email: 'bobby.hernandez@mwtrack.com', full_name: 'Bobby Hernandez', phone: '(720) 555-0201', role: 'member', organization_id: 'org-002', avatar_url: '', created_at: '2025-02-01T00:00:00Z' },
  { id: 'prof-004', email: 'travis.mitchell@mwtrack.com', full_name: 'Travis Mitchell', phone: '(720) 555-0202', role: 'member', organization_id: 'org-002', avatar_url: '', created_at: '2025-02-01T00:00:00Z' },
  { id: 'prof-005', email: 'amy.larson@mwtrack.com', full_name: 'Amy Larson', phone: '(720) 555-0203', role: 'member', organization_id: 'org-002', avatar_url: '', created_at: '2025-02-01T00:00:00Z' },
  { id: 'prof-006', email: 'derek.washington@frsignal.com', full_name: 'Derek Washington', phone: '(303) 555-0301', role: 'member', organization_id: 'org-003', avatar_url: '', created_at: '2025-02-01T00:00:00Z' },
  { id: 'prof-007', email: 'carlos.mendez@frsignal.com', full_name: 'Carlos Mendez', phone: '(303) 555-0302', role: 'member', organization_id: 'org-003', avatar_url: '', created_at: '2025-02-01T00:00:00Z' },
  { id: 'prof-008', email: 'jake.turner@summitgrade.com', full_name: 'Jake Turner', phone: '(719) 555-0401', role: 'member', organization_id: 'org-004', avatar_url: '', created_at: '2025-03-01T00:00:00Z' },
  { id: 'prof-009', email: 'pat.morrison@codot.gov', full_name: 'Patricia Morrison', phone: '(303) 555-0501', role: 'viewer', organization_id: 'org-005', avatar_url: '', created_at: '2025-01-01T00:00:00Z' },
  { id: 'prof-010', email: 'nathan.park@kensingtoneng.com', full_name: 'Dr. Nathan Park', phone: '(303) 555-0601', role: 'manager', organization_id: 'org-006', avatar_url: '', created_at: '2025-01-10T00:00:00Z' },
];

// Helper to attach org data to profiles
export const getProfileWithOrg = (profileId: string): Profile & { organization: Organization } => {
  const profile = seedProfiles.find(p => p.id === profileId)!;
  const org = seedOrganizations.find(o => o.id === profile.organization_id)!;
  return { ...profile, organization: org };
};

// ============================================================
// PROJECT
// ============================================================
export const seedProject: Project = {
  id: 'proj-001',
  name: 'Englewood Yard Expansion — Phase 2',
  description: 'Track expansion including 3 new sidings, signal upgrades with wayside signals and grade crossing protection, and yard reconfiguration for increased capacity at Englewood Yard.',
  status: 'active',
  start_date: '2025-08-26',
  target_end_date: '2026-02-26',
  actual_end_date: null,
  budget_total: 4200000,
  budget_spent: 2100000,
  location: 'Englewood, CO',
  client: 'Colorado & Western Railroad',
  created_by: 'prof-001',
  created_at: '2025-07-15T00:00:00Z',
};

// ============================================================
// PROJECT MEMBERS
// ============================================================
export const seedProjectMembers: ProjectMember[] = [
  { id: 'pm-001', project_id: 'proj-001', profile_id: 'prof-001', project_role: 'manager', can_edit: true, added_at: '2025-07-15T00:00:00Z' },
  { id: 'pm-002', project_id: 'proj-001', profile_id: 'prof-002', project_role: 'manager', can_edit: true, added_at: '2025-07-15T00:00:00Z' },
  { id: 'pm-003', project_id: 'proj-001', profile_id: 'prof-003', project_role: 'foreman', can_edit: true, added_at: '2025-08-01T00:00:00Z' },
  { id: 'pm-004', project_id: 'proj-001', profile_id: 'prof-004', project_role: 'superintendent', can_edit: true, added_at: '2025-08-01T00:00:00Z' },
  { id: 'pm-005', project_id: 'proj-001', profile_id: 'prof-005', project_role: 'engineer', can_edit: true, added_at: '2025-08-01T00:00:00Z' },
  { id: 'pm-006', project_id: 'proj-001', profile_id: 'prof-006', project_role: 'contractor', can_edit: true, added_at: '2025-08-15T00:00:00Z' },
  { id: 'pm-007', project_id: 'proj-001', profile_id: 'prof-007', project_role: 'contractor', can_edit: false, added_at: '2025-08-15T00:00:00Z' },
  { id: 'pm-008', project_id: 'proj-001', profile_id: 'prof-008', project_role: 'foreman', can_edit: true, added_at: '2025-08-20T00:00:00Z' },
  { id: 'pm-009', project_id: 'proj-001', profile_id: 'prof-009', project_role: 'inspector', can_edit: false, added_at: '2025-08-25T00:00:00Z' },
  { id: 'pm-010', project_id: 'proj-001', profile_id: 'prof-010', project_role: 'engineer', can_edit: true, added_at: '2025-07-20T00:00:00Z' },
];

// ============================================================
// SUBMITTALS
// ============================================================
export const seedSubmittals: Submittal[] = [
  {
    id: 'sub-001', project_id: 'proj-001', number: 'SUB-001', title: '136RE Rail — 2,400 LF',
    description: 'Shop drawings and mill certifications for 136RE continuous welded rail per AREMA specifications. Quantity: 2,400 linear feet for Sidings 1-3.',
    spec_section: '34 11 13 - Track Construction', status: 'approved',
    submitted_by: 'prof-004', reviewed_by: 'prof-010', submit_date: '2025-09-15T00:00:00Z',
    due_date: '2025-09-29', review_date: '2025-09-25T00:00:00Z', review_notes: 'Approved. Mill certs verified against AREMA Ch. 4 requirements.',
    milestone_id: 'ms-003', created_at: '2025-09-14T00:00:00Z',
  },
  {
    id: 'sub-002', project_id: 'proj-001', number: 'SUB-002', title: 'Concrete Ties — Type III Pre-stressed',
    description: 'Product data and test reports for Type III pre-stressed concrete ties. Quantity: 3,200 units.',
    spec_section: '34 11 13 - Track Construction', status: 'approved',
    submitted_by: 'prof-004', reviewed_by: 'prof-010', submit_date: '2025-09-20T00:00:00Z',
    due_date: '2025-10-04', review_date: '2025-10-01T00:00:00Z', review_notes: 'Approved with noted compliance to AREMA Ch. 30.',
    milestone_id: 'ms-003', created_at: '2025-09-19T00:00:00Z',
  },
  {
    id: 'sub-003', project_id: 'proj-001', number: 'SUB-003', title: '#24 Turnout Assembly',
    description: 'Complete fabrication drawings for #24 turnout including frog, switch points, closure rails, and guard rails.',
    spec_section: '34 11 16 - Turnouts and Crossings', status: 'under_review',
    submitted_by: 'prof-003', reviewed_by: null, submit_date: '2026-02-10T00:00:00Z',
    due_date: '2026-02-24', review_date: null, review_notes: null,
    milestone_id: 'ms-005', created_at: '2026-02-09T00:00:00Z',
  },
  {
    id: 'sub-004', project_id: 'proj-001', number: 'SUB-004', title: 'Ballast Material — AREMA #4',
    description: 'Gradation test results and source quarry documentation for AREMA #4 ballast material.',
    spec_section: '34 11 13 - Track Construction', status: 'approved',
    submitted_by: 'prof-008', reviewed_by: 'prof-010', submit_date: '2025-09-10T00:00:00Z',
    due_date: '2025-09-24', review_date: '2025-09-20T00:00:00Z', review_notes: 'Gradation meets AREMA spec. Source approved.',
    milestone_id: 'ms-002', created_at: '2025-09-09T00:00:00Z',
  },
  {
    id: 'sub-005', project_id: 'proj-001', number: 'SUB-005', title: 'Signal Mast Foundations',
    description: 'Structural calculations and shop drawings for signal mast foundations including anchor bolt patterns and embedment depths.',
    spec_section: '34 42 13 - Signal Systems', status: 'conditional',
    submitted_by: 'prof-006', reviewed_by: 'prof-010', submit_date: '2025-11-05T00:00:00Z',
    due_date: '2025-11-19', review_date: '2025-11-18T00:00:00Z',
    review_notes: 'Revise foundation depth at Location S-4 to account for high water table. Resubmit detail for S-4 only.',
    milestone_id: 'ms-006', created_at: '2025-11-04T00:00:00Z',
  },
  {
    id: 'sub-006', project_id: 'proj-001', number: 'SUB-006', title: 'LED Wayside Signal Heads',
    description: 'Product data, photometric reports, and color chromaticity data for LED wayside signal units per AREMA C&S Manual.',
    spec_section: '34 42 13 - Signal Systems', status: 'submitted',
    submitted_by: 'prof-006', reviewed_by: null, submit_date: '2026-02-15T00:00:00Z',
    due_date: '2026-03-01', review_date: null, review_notes: null,
    milestone_id: 'ms-007', created_at: '2026-02-14T00:00:00Z',
  },
  {
    id: 'sub-007', project_id: 'proj-001', number: 'SUB-007', title: 'Grade Crossing Gate Mechanisms',
    description: 'Shop drawings and product data for grade crossing gate mechanisms including motor assemblies, counterweights, and gate arms.',
    spec_section: '34 42 16 - Grade Crossing Protection', status: 'under_review',
    submitted_by: 'prof-006', reviewed_by: null, submit_date: '2026-02-05T00:00:00Z',
    due_date: '2026-02-19', review_date: null, review_notes: null,
    milestone_id: 'ms-008', created_at: '2026-02-04T00:00:00Z',
  },
  {
    id: 'sub-008', project_id: 'proj-001', number: 'SUB-008', title: 'Insulated Rail Joints',
    description: 'Product data for insulated rail joints including adhesive specifications and testing certifications.',
    spec_section: '34 11 13 - Track Construction', status: 'approved',
    submitted_by: 'prof-004', reviewed_by: 'prof-010', submit_date: '2025-10-15T00:00:00Z',
    due_date: '2025-10-29', review_date: '2025-10-27T00:00:00Z', review_notes: 'Approved. Compatible with 136RE rail section.',
    milestone_id: 'ms-003', created_at: '2025-10-14T00:00:00Z',
  },
  {
    id: 'sub-009', project_id: 'proj-001', number: 'SUB-009', title: 'Switch Machine — Model SE-12',
    description: 'Product data, installation manual, and maintenance requirements for SE-12 electric switch machines.',
    spec_section: '34 42 13 - Signal Systems', status: 'rejected',
    submitted_by: 'prof-006', reviewed_by: 'prof-010', submit_date: '2025-12-01T00:00:00Z',
    due_date: '2025-12-15', review_date: '2025-12-12T00:00:00Z',
    review_notes: 'Rejected. SE-12 model does not meet the throw force requirements for #24 turnout. Resubmit with SE-17 or equivalent.',
    milestone_id: 'ms-007', created_at: '2025-11-30T00:00:00Z',
  },
  {
    id: 'sub-010', project_id: 'proj-001', number: 'SUB-010', title: 'Track Drainage Plan',
    description: 'Drainage design drawings showing track subgrade drainage, cross-drain locations, and outlet details.',
    spec_section: '33 40 00 - Storm Drainage', status: 'draft',
    submitted_by: 'prof-005', reviewed_by: null, submit_date: '2026-02-20T00:00:00Z',
    due_date: '2026-03-06', review_date: null, review_notes: null,
    milestone_id: 'ms-005', created_at: '2026-02-20T00:00:00Z',
  },
  {
    id: 'sub-011', project_id: 'proj-001', number: 'SUB-011', title: 'Ballast Tamping Specifications',
    description: 'Tamping procedures and equipment specifications for initial and spot tamping operations.',
    spec_section: '34 11 13 - Track Construction', status: 'approved',
    submitted_by: 'prof-003', reviewed_by: 'prof-010', submit_date: '2025-10-01T00:00:00Z',
    due_date: '2025-10-15', review_date: '2025-10-10T00:00:00Z', review_notes: 'Approved per AREMA standards.',
    milestone_id: 'ms-003', created_at: '2025-09-30T00:00:00Z',
  },
  {
    id: 'sub-012', project_id: 'proj-001', number: 'SUB-012', title: 'Signal Cable — 16AWG Quad',
    description: 'Product data for 16AWG quad signal cable including insulation ratings and burial specifications.',
    spec_section: '34 42 13 - Signal Systems', status: 'submitted',
    submitted_by: 'prof-007', reviewed_by: null, submit_date: '2026-02-18T00:00:00Z',
    due_date: '2026-03-04', review_date: null, review_notes: null,
    milestone_id: 'ms-006', created_at: '2026-02-17T00:00:00Z',
  },
  {
    id: 'sub-013', project_id: 'proj-001', number: 'SUB-013', title: 'Crossing Surface Panels — Rubber',
    description: 'Product data and installation details for rubber grade crossing surface panels.',
    spec_section: '34 42 16 - Grade Crossing Protection', status: 'under_review',
    submitted_by: 'prof-003', reviewed_by: null, submit_date: '2026-02-12T00:00:00Z',
    due_date: '2026-02-26', review_date: null, review_notes: null,
    milestone_id: 'ms-008', created_at: '2026-02-11T00:00:00Z',
  },
  {
    id: 'sub-014', project_id: 'proj-001', number: 'SUB-014', title: 'Rail Welding Procedures',
    description: 'Welding procedure specifications for thermite and flash butt welding of 136RE rail.',
    spec_section: '34 11 13 - Track Construction', status: 'conditional',
    submitted_by: 'prof-004', reviewed_by: 'prof-010', submit_date: '2025-11-20T00:00:00Z',
    due_date: '2025-12-04', review_date: '2025-12-02T00:00:00Z',
    review_notes: 'Conditional: add preheat requirements for ambient temps below 32°F.',
    milestone_id: 'ms-003', created_at: '2025-11-19T00:00:00Z',
  },
  {
    id: 'sub-015', project_id: 'proj-001', number: 'SUB-015', title: 'Switch Heater System',
    description: 'Product data for electric switch heater system including power requirements and control logic.',
    spec_section: '34 42 13 - Signal Systems', status: 'draft',
    submitted_by: 'prof-006', reviewed_by: null, submit_date: '2026-02-25T00:00:00Z',
    due_date: '2026-03-11', review_date: null, review_notes: null,
    milestone_id: 'ms-007', created_at: '2026-02-25T00:00:00Z',
  },
];

// ============================================================
// RFIs
// ============================================================
const rfiResponses: Record<string, RFIResponse[]> = {
  'rfi-001': [
    { id: 'rfir-001', rfi_id: 'rfi-001', author_id: 'prof-010', content: 'Utility locate completed. 8" water main confirmed at STA 24+50, 4.2\' below proposed subgrade. Recommend horizontal directional drill for signal conduit to avoid conflict. See attached marked-up drawing.', is_official_response: true, created_at: '2025-10-18T00:00:00Z' },
  ],
  'rfi-003': [
    { id: 'rfir-003', rfi_id: 'rfi-003', author_id: 'prof-010', content: 'Per geotechnical report Section 4.3, frost depth at this location is 36". Foundation depth shall be minimum 48" below finished grade. Increase from 42" shown on drawings.', is_official_response: true, created_at: '2025-12-08T00:00:00Z' },
  ],
  'rfi-004': [
    { id: 'rfir-004a', rfi_id: 'rfi-004', author_id: 'prof-005', content: 'Drawing S-102 shows 12" ballast depth but specification calls for 14" minimum under concrete ties. Which governs?', is_official_response: false, created_at: '2025-10-22T00:00:00Z' },
    { id: 'rfir-004b', rfi_id: 'rfi-004', author_id: 'prof-010', content: 'Specification governs. Use 14" minimum ballast depth throughout Siding 3. Drawing S-102 will be revised in next issue.', is_official_response: true, created_at: '2025-10-25T00:00:00Z' },
  ],
  'rfi-006': [
    { id: 'rfir-006', rfi_id: 'rfi-006', author_id: 'prof-010', content: 'For curved sections with radius less than 1,500\', use flash butt welding only. Thermite welding permitted for curves with radius 1,500\' and greater. Update welding procedure accordingly.', is_official_response: true, created_at: '2026-01-14T00:00:00Z' },
  ],
  'rfi-009': [
    { id: 'rfir-009', rfi_id: 'rfi-009', author_id: 'prof-010', content: 'Geogrid stabilization approved for areas with CBR less than 5. Use Tensar BX1200 or approved equal. Lime stabilization is not permitted due to proximity to drainage features.', is_official_response: true, created_at: '2025-11-08T00:00:00Z' },
  ],
  'rfi-010': [
    { id: 'rfir-010', rfi_id: 'rfi-010', author_id: 'prof-010', content: 'Track gauge at turnouts shall be 56.5" (standard gauge) with tolerance of +1/4", -0". Gauge widening per AREMA Table 5-1 applies through the curved closure rail.', is_official_response: true, created_at: '2026-02-05T00:00:00Z' },
  ],
};

export const seedRFIs: RFI[] = [
  {
    id: 'rfi-001', project_id: 'proj-001', number: 'RFI-001', subject: 'Existing Utility Conflict at STA 24+50',
    question: 'Field survey identified an unmarked utility crossing at STA 24+50 that conflicts with proposed signal conduit routing. Request information on utility type, depth, and owner to determine if relocation is required.',
    answer: 'See response. Utility is 8" water main owned by City of Englewood. Horizontal directional drill recommended for conduit.',
    status: 'answered', priority: 'high', submitted_by: 'prof-006', assigned_to: 'prof-010',
    submit_date: '2025-10-10T00:00:00Z', due_date: '2025-10-24', response_date: '2025-10-18T00:00:00Z',
    milestone_id: 'ms-006', responses: rfiResponses['rfi-001'], created_at: '2025-10-10T00:00:00Z',
  },
  {
    id: 'rfi-002', project_id: 'proj-001', number: 'RFI-002', subject: 'Track Centerline Elevation Discrepancy',
    question: 'Survey data shows a 0.8" discrepancy between design track centerline elevation and existing ground at STA 18+00 to STA 20+00. Please confirm design intent and whether additional subgrade work is required.',
    answer: null, status: 'open', priority: 'medium', submitted_by: 'prof-005', assigned_to: 'prof-010',
    submit_date: '2026-02-14T00:00:00Z', due_date: '2026-02-28', response_date: null,
    milestone_id: 'ms-004', responses: [], created_at: '2026-02-14T00:00:00Z',
  },
  {
    id: 'rfi-003', project_id: 'proj-001', number: 'RFI-003', subject: 'Signal Foundation Depth at Grade Crossing',
    question: 'Drawings show signal mast foundation depth as 42" at the Main St. grade crossing. Geotechnical report indicates frost depth of 36" at this location. Should foundation depth be increased to provide adequate frost protection?',
    answer: 'Foundation depth shall be 48" minimum below finished grade. See response.',
    status: 'answered', priority: 'high', submitted_by: 'prof-006', assigned_to: 'prof-010',
    submit_date: '2025-12-01T00:00:00Z', due_date: '2025-12-15', response_date: '2025-12-08T00:00:00Z',
    milestone_id: 'ms-006', responses: rfiResponses['rfi-003'], created_at: '2025-12-01T00:00:00Z',
  },
  {
    id: 'rfi-004', project_id: 'proj-001', number: 'RFI-004', subject: 'Ballast Depth Clarification — Siding 3',
    question: 'Drawing S-102 shows 12" ballast depth for Siding 3 but specification Section 34 11 13.3.2 requires 14" minimum under concrete ties. Please clarify which dimension governs.',
    answer: 'Specification governs. Use 14" minimum ballast depth. Drawing will be revised.',
    status: 'closed', priority: 'medium', submitted_by: 'prof-005', assigned_to: 'prof-010',
    submit_date: '2025-10-20T00:00:00Z', due_date: '2025-11-03', response_date: '2025-10-25T00:00:00Z',
    milestone_id: 'ms-005', responses: rfiResponses['rfi-004'], created_at: '2025-10-20T00:00:00Z',
  },
  {
    id: 'rfi-005', project_id: 'proj-001', number: 'RFI-005', subject: 'Turnout Geometry Conflict with Existing Drainage',
    question: 'Proposed #24 turnout at STA 32+00 conflicts with existing 24" storm drain pipe at 3.5\' depth. Turnout excavation will require removal or relocation of pipe. Request direction on preferred resolution.',
    answer: null, status: 'overdue', priority: 'critical', submitted_by: 'prof-003', assigned_to: 'prof-010',
    submit_date: '2026-01-20T00:00:00Z', due_date: '2026-02-03', response_date: null,
    milestone_id: 'ms-005', responses: [], created_at: '2026-01-20T00:00:00Z',
  },
  {
    id: 'rfi-006', project_id: 'proj-001', number: 'RFI-006', subject: 'Rail Welding Procedure for Curved Sections',
    question: 'Specification permits both thermite and flash butt welding. Are there restrictions on welding method for curved track sections with radius less than 2,000 feet?',
    answer: 'Flash butt only for curves < 1,500\' radius. Thermite permitted for curves >= 1,500\'.',
    status: 'answered', priority: 'medium', submitted_by: 'prof-004', assigned_to: 'prof-010',
    submit_date: '2026-01-08T00:00:00Z', due_date: '2026-01-22', response_date: '2026-01-14T00:00:00Z',
    milestone_id: 'ms-003', responses: rfiResponses['rfi-006'], created_at: '2026-01-08T00:00:00Z',
  },
  {
    id: 'rfi-007', project_id: 'proj-001', number: 'RFI-007', subject: 'Grade Crossing Signal Timing Requirements',
    question: 'What are the required warning times and gate descent timing for the Main St. grade crossing? Design documents reference FRA standards but do not specify exact values for this location.',
    answer: null, status: 'open', priority: 'high', submitted_by: 'prof-006', assigned_to: 'prof-010',
    submit_date: '2026-02-10T00:00:00Z', due_date: '2026-02-24', response_date: null,
    milestone_id: 'ms-008', responses: [], created_at: '2026-02-10T00:00:00Z',
  },
  {
    id: 'rfi-008', project_id: 'proj-001', number: 'RFI-008', subject: 'Switch Machine Power Supply Routing',
    question: 'Drawings show power supply routing for switch machines through existing duct bank. Field investigation reveals duct bank is at capacity. Request alternative routing direction.',
    answer: null, status: 'open', priority: 'medium', submitted_by: 'prof-007', assigned_to: 'prof-010',
    submit_date: '2026-02-18T00:00:00Z', due_date: '2026-03-04', response_date: null,
    milestone_id: 'ms-007', responses: [], created_at: '2026-02-18T00:00:00Z',
  },
  {
    id: 'rfi-009', project_id: 'proj-001', number: 'RFI-009', subject: 'Subgrade Stabilization Method',
    question: 'Geotechnical report identifies soft subgrade (CBR < 5) in the area of Siding 2, STA 12+00 to STA 14+50. Specification allows geogrid or lime stabilization. Which method is preferred for this location?',
    answer: 'Geogrid stabilization approved. Lime not permitted near drainage features. See response.',
    status: 'closed', priority: 'medium', submitted_by: 'prof-008', assigned_to: 'prof-010',
    submit_date: '2025-11-01T00:00:00Z', due_date: '2025-11-15', response_date: '2025-11-08T00:00:00Z',
    milestone_id: 'ms-002', responses: rfiResponses['rfi-009'], created_at: '2025-11-01T00:00:00Z',
  },
  {
    id: 'rfi-010', project_id: 'proj-001', number: 'RFI-010', subject: 'Track Gauge Tolerance at Turnout',
    question: 'What is the allowable track gauge tolerance at the #24 turnout? Standard gauge is 56.5" but AREMA allows gauge widening through curved closure rail. Please specify allowable range.',
    answer: 'Standard gauge 56.5" with +1/4", -0" tolerance. Gauge widening per AREMA Table 5-1.',
    status: 'answered', priority: 'low', submitted_by: 'prof-003', assigned_to: 'prof-010',
    submit_date: '2026-01-28T00:00:00Z', due_date: '2026-02-11', response_date: '2026-02-05T00:00:00Z',
    milestone_id: 'ms-005', responses: rfiResponses['rfi-010'], created_at: '2026-01-28T00:00:00Z',
  },
];

// ============================================================
// DAILY LOGS (25 entries — 5 weeks of weekdays)
// ============================================================
const weatherOptions = [
  { temp: 28, conditions: 'Clear, cold', wind: 'NW 8 mph' },
  { temp: 35, conditions: 'Partly cloudy', wind: 'W 12 mph' },
  { temp: 42, conditions: 'Overcast', wind: 'SW 6 mph' },
  { temp: 38, conditions: 'Light snow', wind: 'N 15 mph' },
  { temp: 45, conditions: 'Clear, sunny', wind: 'S 5 mph' },
  { temp: 31, conditions: 'Cloudy, flurries', wind: 'NW 18 mph' },
  { temp: 48, conditions: 'Clear, warm', wind: 'SW 4 mph' },
  { temp: 33, conditions: 'Overcast, cold', wind: 'N 10 mph' },
  { temp: 40, conditions: 'Partly cloudy', wind: 'W 8 mph' },
  { temp: 27, conditions: 'Snow, 2-3 inches', wind: 'NE 20 mph' },
];

function makeDailyLog(idx: number, date: string, w: typeof weatherOptions[0], summary: string, safetyNote: string | null,
  personnel: { role: string; headcount: number; company: string }[],
  equipment: { type: string; count: number; notes: string }[],
  workItems: { desc: string; qty: number; unit: string; loc: string }[]
): DailyLog {
  return {
    id: `dl-${String(idx).padStart(3, '0')}`,
    project_id: 'proj-001', log_date: date, created_by: 'prof-003',
    weather_temp: w.temp, weather_conditions: w.conditions, weather_wind: w.wind,
    work_summary: summary, safety_notes: safetyNote || '',
    personnel: personnel.map((p, i) => ({ id: `dlp-${idx}-${i}`, daily_log_id: `dl-${String(idx).padStart(3, '0')}`, role: p.role, headcount: p.headcount, company: p.company })),
    equipment: equipment.map((e, i) => ({ id: `dle-${idx}-${i}`, daily_log_id: `dl-${String(idx).padStart(3, '0')}`, equipment_type: e.type, count: e.count, notes: e.notes })),
    work_items: workItems.map((w, i) => ({ id: `dlw-${idx}-${i}`, daily_log_id: `dl-${String(idx).padStart(3, '0')}`, description: w.desc, quantity: w.qty, unit: w.unit, location: w.loc })),
    created_at: `${date}T17:00:00Z`,
  };
}

export const seedDailyLogs: DailyLog[] = [
  makeDailyLog(1, '2026-01-19', weatherOptions[0], 'Continued rail installation on Siding 1 from STA 8+00 to STA 10+50. Cold temps required preheat for thermite welds.', 'Safety briefing on cold weather PPE requirements.',
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 8, company: 'Mountain West Track' }, { role: 'Operator', headcount: 3, company: 'Mountain West Track' }],
    [{ type: 'Rail Threader', count: 1, notes: 'On track' }, { type: 'Excavator - CAT 320', count: 1, notes: 'Ballast placement' }],
    [{ desc: 'Rail installation - 136RE CWR', qty: 250, unit: 'LF', loc: 'Siding 1, STA 8+00 to 10+50' }, { desc: 'Thermite rail welds', qty: 4, unit: 'each', loc: 'Siding 1' }],
  ),
  makeDailyLog(2, '2026-01-20', weatherOptions[1], 'Ballast placement and initial tamping on Siding 1 between STA 6+00 and STA 8+00. Regulator made first pass.', null,
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 10, company: 'Mountain West Track' }, { role: 'Operator', headcount: 4, company: 'Mountain West Track' }],
    [{ type: 'Tamper - Plasser 09-32', count: 1, notes: 'Initial surfacing' }, { type: 'Ballast Regulator', count: 1, notes: 'Shoulder dressing' }, { type: 'Dump Truck', count: 3, notes: 'Ballast delivery' }],
    [{ desc: 'Ballast placement - AREMA #4', qty: 180, unit: 'CY', loc: 'Siding 1, STA 6+00 to 8+00' }, { desc: 'Initial tamping pass', qty: 200, unit: 'LF', loc: 'Siding 1, STA 6+00 to 8+00' }],
  ),
  makeDailyLog(3, '2026-01-21', weatherOptions[2], 'Concrete tie installation on Siding 1 from STA 10+50 to STA 12+00. Signal conduit trenching began at south end.', 'Utility locate marks refreshed before conduit trenching.',
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 8, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 2, company: 'Front Range Signal' }],
    [{ type: 'Excavator - CAT 320', count: 1, notes: 'Tie distribution' }, { type: 'Trencher', count: 1, notes: 'Signal conduit' }],
    [{ desc: 'Concrete tie placement', qty: 120, unit: 'each', loc: 'Siding 1, STA 10+50 to 12+00' }, { desc: 'Signal conduit trench', qty: 150, unit: 'LF', loc: 'South yard area' }],
  ),
  makeDailyLog(4, '2026-01-22', weatherOptions[3], 'Light snow delayed start by 1 hour. Continued tie placement and rail threading on Siding 1. Snow cleared from work area by 9 AM.', 'Slippery conditions — sand applied to walkways. Extra caution around equipment.',
    [{ role: 'Foreman', headcount: 1, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 6, company: 'Mountain West Track' }, { role: 'Operator', headcount: 2, company: 'Mountain West Track' }],
    [{ type: 'Rail Threader', count: 1, notes: 'On track' }, { type: 'Loader - CAT 950', count: 1, notes: 'Snow removal / material handling' }],
    [{ desc: 'Concrete tie placement', qty: 80, unit: 'each', loc: 'Siding 1, STA 12+00 to 13+00' }, { desc: 'Rail installation - 136RE CWR', qty: 100, unit: 'LF', loc: 'Siding 1, STA 10+50 to 11+50' }],
  ),
  makeDailyLog(5, '2026-01-23', weatherOptions[4], 'Good weather. Rail installation caught up to tie placement on Siding 1. Began subgrade prep for Siding 2 at south end.', null,
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 10, company: 'Mountain West Track' }, { role: 'Operator', headcount: 4, company: 'Mountain West Track' }, { role: 'Grading Foreman', headcount: 1, company: 'Summit Grade' }],
    [{ type: 'Rail Threader', count: 1, notes: '' }, { type: 'Excavator - CAT 320', count: 2, notes: 'Subgrade work + tie distribution' }, { type: 'Compactor', count: 1, notes: 'Subgrade' }],
    [{ desc: 'Rail installation - 136RE CWR', qty: 200, unit: 'LF', loc: 'Siding 1' }, { desc: 'Subgrade excavation', qty: 85, unit: 'CY', loc: 'Siding 2, STA 0+00 to 2+00' }],
  ),
  makeDailyLog(6, '2026-01-26', weatherOptions[5], 'Cold and windy conditions. Focused on signal conduit installation. Limited track work due to wind.', 'Wind advisory — crane operations suspended for the day.',
    [{ role: 'Signal Tech', headcount: 3, company: 'Front Range Signal' }, { role: 'Track Laborer', headcount: 4, company: 'Mountain West Track' }, { role: 'Foreman', headcount: 1, company: 'Mountain West Track' }],
    [{ type: 'Trencher', count: 1, notes: 'Signal conduit' }, { type: 'Pickup Trucks', count: 3, notes: 'Material transport' }],
    [{ desc: 'Signal conduit installation - 4" PVC', qty: 200, unit: 'LF', loc: 'South yard' }, { desc: 'Junction box installation', qty: 2, unit: 'each', loc: 'JB-4, JB-5' }],
  ),
  makeDailyLog(7, '2026-01-27', weatherOptions[6], 'Warm day for January. Full crew on Siding 1 track work and Siding 2 subgrade. Inspector on site for Siding 1 track geometry check.', null,
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 12, company: 'Mountain West Track' }, { role: 'Operator', headcount: 4, company: 'Mountain West Track' }, { role: 'Inspector', headcount: 1, company: 'Colorado DOT' }],
    [{ type: 'Tamper - Plasser 09-32', count: 1, notes: '' }, { type: 'Ballast Regulator', count: 1, notes: '' }, { type: 'Excavator - CAT 320', count: 1, notes: 'Siding 2 subgrade' }],
    [{ desc: 'Final tamping - Siding 1', qty: 400, unit: 'LF', loc: 'Siding 1, STA 6+00 to 10+00' }, { desc: 'Subgrade grading', qty: 120, unit: 'CY', loc: 'Siding 2' }, { desc: 'Track geometry verification', qty: 800, unit: 'LF', loc: 'Siding 1' }],
  ),
  makeDailyLog(8, '2026-01-28', weatherOptions[7], 'Continued Siding 2 subgrade preparation. Geogrid installation began at soft area STA 12+00-14+50.', null,
    [{ role: 'Foreman', headcount: 1, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 6, company: 'Mountain West Track' }, { role: 'Grading Foreman', headcount: 1, company: 'Summit Grade' }, { role: 'Laborer', headcount: 4, company: 'Summit Grade' }],
    [{ type: 'Excavator - CAT 320', count: 1, notes: '' }, { type: 'Compactor', count: 1, notes: '' }, { type: 'Dump Truck', count: 2, notes: 'Unsuitable material removal' }],
    [{ desc: 'Geogrid installation - Tensar BX1200', qty: 3200, unit: 'SF', loc: 'Siding 2, STA 12+00 to 14+50' }, { desc: 'Unsuitable subgrade removal', qty: 65, unit: 'CY', loc: 'Siding 2' }],
  ),
  makeDailyLog(9, '2026-01-29', weatherOptions[8], 'Subballast placement on Siding 2 over geogrid areas. Signal crew continued conduit runs along east side.', 'Confined space entry permit obtained for junction box JB-6.',
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 8, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 2, company: 'Front Range Signal' }, { role: 'Operator', headcount: 3, company: 'Mountain West Track' }],
    [{ type: 'Dump Truck', count: 4, notes: 'Subballast delivery' }, { type: 'Loader - CAT 950', count: 1, notes: '' }, { type: 'Trencher', count: 1, notes: '' }],
    [{ desc: 'Subballast placement', qty: 150, unit: 'CY', loc: 'Siding 2, STA 10+00 to 14+50' }, { desc: 'Signal conduit - 4" PVC', qty: 175, unit: 'LF', loc: 'East yard' }],
  ),
  makeDailyLog(10, '2026-01-30', weatherOptions[9], 'Heavy snow shut down site at noon. Morning work limited to material staging and equipment maintenance. All workers off site by 12:30 PM.', 'Site closed early due to weather. Roads impassable by afternoon.',
    [{ role: 'Foreman', headcount: 1, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 4, company: 'Mountain West Track' }],
    [{ type: 'Loader - CAT 950', count: 1, notes: 'Snow clearing' }],
    [{ desc: 'Material staging - concrete ties', qty: 80, unit: 'each', loc: 'Staging area B' }],
  ),
  makeDailyLog(11, '2026-02-02', weatherOptions[4], 'Snow cleared from site. Resumed Siding 2 subgrade and ballast work. Tie distribution on Siding 2 began.', null,
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 10, company: 'Mountain West Track' }, { role: 'Operator', headcount: 3, company: 'Mountain West Track' }],
    [{ type: 'Excavator - CAT 320', count: 1, notes: '' }, { type: 'Loader - CAT 950', count: 1, notes: '' }, { type: 'Dump Truck', count: 3, notes: '' }],
    [{ desc: 'Ballast placement - AREMA #4', qty: 200, unit: 'CY', loc: 'Siding 2, STA 6+00 to 10+00' }, { desc: 'Concrete tie distribution', qty: 150, unit: 'each', loc: 'Siding 2' }],
  ),
  makeDailyLog(12, '2026-02-03', weatherOptions[1], 'Tie installation and rail threading on Siding 2. Signal foundation excavation at Location S-1 and S-2.', null,
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 10, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 3, company: 'Front Range Signal' }, { role: 'Operator', headcount: 3, company: 'Mountain West Track' }],
    [{ type: 'Rail Threader', count: 1, notes: '' }, { type: 'Excavator - CAT 320', count: 2, notes: '' }],
    [{ desc: 'Concrete tie placement', qty: 160, unit: 'each', loc: 'Siding 2, STA 0+00 to 4+00' }, { desc: 'Rail installation - 136RE CWR', qty: 180, unit: 'LF', loc: 'Siding 2' }, { desc: 'Signal foundation excavation', qty: 2, unit: 'each', loc: 'S-1, S-2' }],
  ),
  makeDailyLog(13, '2026-02-04', weatherOptions[2], 'Continued rail work on Siding 2. Poured signal mast foundations S-1 and S-2. Concrete cured under blankets.', null,
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 8, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 2, company: 'Front Range Signal' }, { role: 'Concrete Crew', headcount: 4, company: 'Summit Grade' }],
    [{ type: 'Concrete Truck', count: 2, notes: 'Foundation pours' }, { type: 'Rail Threader', count: 1, notes: '' }],
    [{ desc: 'Signal mast foundation pour', qty: 2, unit: 'each', loc: 'S-1, S-2' }, { desc: 'Rail installation', qty: 200, unit: 'LF', loc: 'Siding 2, STA 4+00 to 6+00' }],
  ),
  makeDailyLog(14, '2026-02-05', weatherOptions[8], 'Siding 2 rail installation approaching halfway mark. Ballast delivery steady. Signal conduit complete on south and east sides.', 'Tailgate safety meeting — crane hand signals reviewed before afternoon lift.',
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 12, company: 'Mountain West Track' }, { role: 'Operator', headcount: 4, company: 'Mountain West Track' }],
    [{ type: 'Crane - 60 ton', count: 1, notes: 'Turnout component staging' }, { type: 'Dump Truck', count: 4, notes: 'Ballast' }],
    [{ desc: 'Rail installation', qty: 220, unit: 'LF', loc: 'Siding 2' }, { desc: 'Ballast placement', qty: 160, unit: 'CY', loc: 'Siding 2' }],
  ),
  makeDailyLog(15, '2026-02-06', weatherOptions[0], 'Cold start. Focused on Siding 2 ballast and tamping. Signal crew pulled cable through conduit runs on south side.', null,
    [{ role: 'Foreman', headcount: 1, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 8, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 3, company: 'Front Range Signal' }, { role: 'Operator', headcount: 3, company: 'Mountain West Track' }],
    [{ type: 'Tamper - Plasser 09-32', count: 1, notes: '' }, { type: 'Ballast Regulator', count: 1, notes: '' }],
    [{ desc: 'Ballast tamping - initial pass', qty: 300, unit: 'LF', loc: 'Siding 2, STA 0+00 to 3+00' }, { desc: 'Signal cable pull - 16AWG quad', qty: 800, unit: 'LF', loc: 'South conduit run' }],
  ),
  makeDailyLog(16, '2026-02-09', weatherOptions[6], 'Productive day. Siding 2 rail work past STA 8+00. Began insulated joint installation. Inspector visited for ballast sampling.', null,
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 10, company: 'Mountain West Track' }, { role: 'Inspector', headcount: 1, company: 'Colorado DOT' }, { role: 'Operator', headcount: 3, company: 'Mountain West Track' }],
    [{ type: 'Rail Threader', count: 1, notes: '' }, { type: 'Excavator - CAT 320', count: 1, notes: '' }, { type: 'Dump Truck', count: 3, notes: '' }],
    [{ desc: 'Rail installation', qty: 250, unit: 'LF', loc: 'Siding 2, STA 6+00 to 8+50' }, { desc: 'Insulated joint installation', qty: 4, unit: 'each', loc: 'Siding 1 & 2' }, { desc: 'Ballast sampling for QC', qty: 3, unit: 'samples', loc: 'Siding 2' }],
  ),
  makeDailyLog(17, '2026-02-10', weatherOptions[3], 'Light snow in AM. Track work continued. Signal foundation forms set for S-3.', 'Icy conditions on access road. Salt applied at 7 AM.',
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 8, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 2, company: 'Front Range Signal' }],
    [{ type: 'Excavator - CAT 320', count: 1, notes: '' }, { type: 'Concrete Forms', count: 1, notes: 'Foundation S-3' }],
    [{ desc: 'Rail installation', qty: 150, unit: 'LF', loc: 'Siding 2' }, { desc: 'Signal foundation formwork', qty: 1, unit: 'each', loc: 'S-3' }],
  ),
  makeDailyLog(18, '2026-02-11', weatherOptions[8], 'Good progress on Siding 2. Approaching final 30% of rail installation. Signal foundation S-3 poured.', null,
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 12, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 2, company: 'Front Range Signal' }, { role: 'Concrete Crew', headcount: 3, company: 'Summit Grade' }, { role: 'Operator', headcount: 4, company: 'Mountain West Track' }],
    [{ type: 'Rail Threader', count: 1, notes: '' }, { type: 'Concrete Truck', count: 1, notes: '' }, { type: 'Crane - 60 ton', count: 1, notes: '' }],
    [{ desc: 'Rail installation', qty: 280, unit: 'LF', loc: 'Siding 2, STA 8+50 to 11+30' }, { desc: 'Signal foundation pour - S-3', qty: 1, unit: 'each', loc: 'S-3' }],
  ),
  makeDailyLog(19, '2026-02-12', weatherOptions[4], 'Siding 2 rail work wrapping up. Began turnout assembly staging. Full ballast and tamping crew mobilized.', null,
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 14, company: 'Mountain West Track' }, { role: 'Operator', headcount: 5, company: 'Mountain West Track' }],
    [{ type: 'Tamper - Plasser 09-32', count: 1, notes: '' }, { type: 'Ballast Regulator', count: 1, notes: '' }, { type: 'Crane - 60 ton', count: 1, notes: 'Turnout components' }, { type: 'Dump Truck', count: 4, notes: '' }],
    [{ desc: 'Rail installation', qty: 200, unit: 'LF', loc: 'Siding 2' }, { desc: 'Ballast tamping', qty: 500, unit: 'LF', loc: 'Siding 2' }, { desc: 'Turnout component staging', qty: 1, unit: 'set', loc: 'Staging area A' }],
  ),
  makeDailyLog(20, '2026-02-13', weatherOptions[7], 'Overcast. Track surfacing and alignment on Siding 2. Signal crew terminated cables at junction boxes JB-1 through JB-4.', null,
    [{ role: 'Foreman', headcount: 1, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 8, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 4, company: 'Front Range Signal' }, { role: 'Operator', headcount: 3, company: 'Mountain West Track' }],
    [{ type: 'Tamper - Plasser 09-32', count: 1, notes: 'Spot tamping' }, { type: 'Ballast Regulator', count: 1, notes: '' }],
    [{ desc: 'Track surfacing and alignment', qty: 600, unit: 'LF', loc: 'Siding 2' }, { desc: 'Signal cable termination', qty: 4, unit: 'each', loc: 'JB-1 to JB-4' }],
  ),
  makeDailyLog(21, '2026-02-16', weatherOptions[4], 'Began Siding 1 punch list items. Addressing ballast shoulder deficiencies and tie plate seating issues identified by inspector.', null,
    [{ role: 'Foreman', headcount: 1, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 6, company: 'Mountain West Track' }, { role: 'Inspector', headcount: 1, company: 'Colorado DOT' }],
    [{ type: 'Ballast Regulator', count: 1, notes: 'Shoulder corrections' }, { type: 'Loader - CAT 950', count: 1, notes: '' }],
    [{ desc: 'Ballast shoulder correction', qty: 300, unit: 'LF', loc: 'Siding 1' }, { desc: 'Tie plate re-seating', qty: 12, unit: 'each', loc: 'Siding 1' }],
  ),
  makeDailyLog(22, '2026-02-17', weatherOptions[1], 'Signal mast erection at S-1 and S-2. Track geometry re-check on Siding 1 after corrections.', 'Crane safety plan reviewed. Exclusion zone established during lifts.',
    [{ role: 'Foreman', headcount: 1, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 4, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 4, company: 'Front Range Signal' }, { role: 'Operator', headcount: 2, company: 'Mountain West Track' }],
    [{ type: 'Crane - 60 ton', count: 1, notes: 'Signal mast erection' }, { type: 'Boom Truck', count: 1, notes: '' }],
    [{ desc: 'Signal mast installation', qty: 2, unit: 'each', loc: 'S-1, S-2' }, { desc: 'Track geometry re-verification', qty: 800, unit: 'LF', loc: 'Siding 1' }],
  ),
  makeDailyLog(23, '2026-02-18', weatherOptions[2], 'Continued signal work. Began mounting signal heads on S-1. Siding 2 ballast regulator making final shoulder pass.', null,
    [{ role: 'Signal Tech', headcount: 4, company: 'Front Range Signal' }, { role: 'Foreman', headcount: 1, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 6, company: 'Mountain West Track' }, { role: 'Operator', headcount: 2, company: 'Mountain West Track' }],
    [{ type: 'Boom Truck', count: 1, notes: 'Signal head mounting' }, { type: 'Ballast Regulator', count: 1, notes: '' }],
    [{ desc: 'Signal head mounting', qty: 3, unit: 'each', loc: 'S-1' }, { desc: 'Ballast shoulder dressing', qty: 400, unit: 'LF', loc: 'Siding 2' }],
  ),
  makeDailyLog(24, '2026-02-19', weatherOptions[8], 'Inspector walkthrough on Siding 2. Several punch list items identified. Signal wiring continued at S-1 and S-2.', 'Inspector noted need for additional delineators at construction zone access points.',
    [{ role: 'Inspector', headcount: 1, company: 'Colorado DOT' }, { role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 8, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 3, company: 'Front Range Signal' }],
    [{ type: 'Boom Truck', count: 1, notes: '' }, { type: 'Pickup Trucks', count: 4, notes: '' }],
    [{ desc: 'Signal wiring and termination', qty: 2, unit: 'masts', loc: 'S-1, S-2' }, { desc: 'Punch list walkthrough', qty: 1, unit: 'inspection', loc: 'Siding 2' }],
  ),
  makeDailyLog(25, '2026-02-20', weatherOptions[4], 'End of week. Focused on punch list corrections on Sidings 1 & 2. Signal testing prep at S-1.', null,
    [{ role: 'Foreman', headcount: 2, company: 'Mountain West Track' }, { role: 'Track Laborer', headcount: 10, company: 'Mountain West Track' }, { role: 'Signal Tech', headcount: 3, company: 'Front Range Signal' }, { role: 'Operator', headcount: 2, company: 'Mountain West Track' }],
    [{ type: 'Tamper - Plasser 09-32', count: 1, notes: 'Spot corrections' }, { type: 'Boom Truck', count: 1, notes: '' }],
    [{ desc: 'Punch list corrections - track', qty: 8, unit: 'items', loc: 'Sidings 1 & 2' }, { desc: 'Signal pre-test inspection', qty: 1, unit: 'each', loc: 'S-1' }],
  ),
];

// ============================================================
// PUNCH LIST ITEMS (18)
// ============================================================
export const seedPunchListItems: PunchListItem[] = [
  { id: 'pl-001', project_id: 'proj-001', number: 'PL-001', title: 'Rail alignment exceeds tolerance at STA 9+25', description: 'Rail alignment measured 3/8" beyond tolerance at STA 9+25 on Siding 1. Specification allows +/- 1/4".', location: 'Siding 1, STA 9+25', status: 'resolved', priority: 'high', assigned_to: 'prof-003', created_by: 'prof-009', due_date: '2026-02-14', resolved_date: '2026-02-16T00:00:00Z', verified_date: null, resolution_notes: 'Spot tamped and realigned. Measured within tolerance.', created_at: '2026-02-05T00:00:00Z' },
  { id: 'pl-002', project_id: 'proj-001', number: 'PL-002', title: 'Ballast shoulder insufficient — north side STA 6+00 to 7+00', description: 'Ballast shoulder width is 8" instead of required 12" minimum on north side of track.', location: 'Siding 1, STA 6+00 to 7+00', status: 'verified', priority: 'medium', assigned_to: 'prof-003', created_by: 'prof-009', due_date: '2026-02-10', resolved_date: '2026-02-09T00:00:00Z', verified_date: '2026-02-16T00:00:00Z', resolution_notes: 'Additional ballast placed and regulated. Shoulder now 14".', created_at: '2026-02-03T00:00:00Z' },
  { id: 'pl-003', project_id: 'proj-001', number: 'PL-003', title: 'Signal cable splice box not sealed', description: 'Splice box at JB-3 found open with exposed cable terminations. Must be sealed to prevent moisture intrusion.', location: 'Junction Box JB-3', status: 'in_progress', priority: 'critical', assigned_to: 'prof-006', created_by: 'prof-009', due_date: '2026-02-20', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-12T00:00:00Z' },
  { id: 'pl-004', project_id: 'proj-001', number: 'PL-004', title: 'Tie plate not properly seated — 6 locations', description: '6 tie plates on Siding 1 between STA 11+00 and 12+00 are not fully seated on ties. Plates rocking under load.', location: 'Siding 1, STA 11+00 to 12+00', status: 'resolved', priority: 'high', assigned_to: 'prof-003', created_by: 'prof-009', due_date: '2026-02-17', resolved_date: '2026-02-16T00:00:00Z', verified_date: null, resolution_notes: 'Plates lifted, tie surfaces cleaned and re-seated. All 6 locations corrected.', created_at: '2026-02-10T00:00:00Z' },
  { id: 'pl-005', project_id: 'proj-001', number: 'PL-005', title: 'Drainage grade incorrect at STA 4+50', description: 'Cross-drain at STA 4+50 has reverse grade. Water pooling on track side instead of draining away.', location: 'Siding 2, STA 4+50', status: 'open', priority: 'critical', assigned_to: 'prof-008', created_by: 'prof-005', due_date: '2026-02-24', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-14T00:00:00Z' },
  { id: 'pl-006', project_id: 'proj-001', number: 'PL-006', title: 'Missing rail clips — 4 locations', description: 'Pandrol e-clips missing at 4 tie locations on Siding 2 near STA 3+00.', location: 'Siding 2, STA 3+00', status: 'in_progress', priority: 'medium', assigned_to: 'prof-003', created_by: 'prof-009', due_date: '2026-02-21', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-13T00:00:00Z' },
  { id: 'pl-007', project_id: 'proj-001', number: 'PL-007', title: 'Conduit marker posts missing at 3 locations', description: 'Signal conduit marker posts not installed at direction changes per specification.', location: 'South yard signal conduit run', status: 'open', priority: 'low', assigned_to: 'prof-007', created_by: 'prof-009', due_date: '2026-02-28', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-15T00:00:00Z' },
  { id: 'pl-008', project_id: 'proj-001', number: 'PL-008', title: 'Ballast contamination — mud intrusion', description: 'Mud fouling of ballast at Siding 2, STA 12+00 to 13+00 due to inadequate subgrade drainage during rain event.', location: 'Siding 2, STA 12+00 to 13+00', status: 'in_progress', priority: 'high', assigned_to: 'prof-008', created_by: 'prof-005', due_date: '2026-02-25', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-16T00:00:00Z' },
  { id: 'pl-009', project_id: 'proj-001', number: 'PL-009', title: 'Signal mast plumb out of tolerance at S-2', description: 'Signal mast at S-2 measured 1.5° off plumb. Specification requires within 0.5°.', location: 'Signal Location S-2', status: 'in_progress', priority: 'high', assigned_to: 'prof-006', created_by: 'prof-009', due_date: '2026-02-22', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-18T00:00:00Z' },
  { id: 'pl-010', project_id: 'proj-001', number: 'PL-010', title: 'Track gauge tight at 3 tie locations', description: 'Track gauge measured 56-1/4" (tight) at 3 locations near insulated joint on Siding 1.', location: 'Siding 1, IJ near STA 15+00', status: 'resolved', priority: 'medium', assigned_to: 'prof-003', created_by: 'prof-009', due_date: '2026-02-18', resolved_date: '2026-02-17T00:00:00Z', verified_date: null, resolution_notes: 'Gauge adjusted to 56-1/2" at all 3 locations.', created_at: '2026-02-12T00:00:00Z' },
  { id: 'pl-011', project_id: 'proj-001', number: 'PL-011', title: 'Erosion at conduit trench backfill', description: 'Backfill settlement and erosion along signal conduit trench near JB-5.', location: 'Near Junction Box JB-5', status: 'open', priority: 'medium', assigned_to: 'prof-008', created_by: 'prof-005', due_date: '2026-02-26', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-18T00:00:00Z' },
  { id: 'pl-012', project_id: 'proj-001', number: 'PL-012', title: 'Thermite weld collar needs grinding', description: 'Thermite weld at STA 10+20 on Siding 1 has excess collar material. Needs grinding to match rail profile.', location: 'Siding 1, STA 10+20', status: 'verified', priority: 'medium', assigned_to: 'prof-003', created_by: 'prof-009', due_date: '2026-02-12', resolved_date: '2026-02-11T00:00:00Z', verified_date: '2026-02-14T00:00:00Z', resolution_notes: 'Ground to profile and checked with straightedge.', created_at: '2026-02-07T00:00:00Z' },
  { id: 'pl-013', project_id: 'proj-001', number: 'PL-013', title: 'Anchor bolt torque below spec at S-1', description: 'Foundation anchor bolts at S-1 torqued to 80 ft-lbs. Specification requires 120 ft-lbs.', location: 'Signal Location S-1', status: 'in_progress', priority: 'medium', assigned_to: 'prof-006', created_by: 'prof-009', due_date: '2026-02-24', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-19T00:00:00Z' },
  { id: 'pl-014', project_id: 'proj-001', number: 'PL-014', title: 'Construction debris in drainage ditch', description: 'Wood forms, wire ties, and plastic sheeting in drainage ditch along Siding 1.', location: 'Siding 1, south drainage ditch', status: 'open', priority: 'low', assigned_to: 'prof-003', created_by: 'prof-009', due_date: '2026-02-28', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-19T00:00:00Z' },
  { id: 'pl-015', project_id: 'proj-001', number: 'PL-015', title: 'Crossing surface panel gap exceeds spec', description: 'Gap between rubber crossing panels at Main St. measured 1-1/4". Maximum allowed is 3/4".', location: 'Main St. Grade Crossing', status: 'open', priority: 'medium', assigned_to: 'prof-003', created_by: 'prof-009', due_date: '2026-03-01', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-20T00:00:00Z' },
  { id: 'pl-016', project_id: 'proj-001', number: 'PL-016', title: 'OTM spike pattern irregular', description: 'OTM spike pattern on 8 ties does not match specification. Spikes installed in wrong positions.', location: 'Siding 2, STA 5+50 to 6+00', status: 'in_progress', priority: 'medium', assigned_to: 'prof-003', created_by: 'prof-009', due_date: '2026-02-23', resolved_date: null, verified_date: null, resolution_notes: null, created_at: '2026-02-17T00:00:00Z' },
  { id: 'pl-017', project_id: 'proj-001', number: 'PL-017', title: 'Grounding rod missing at S-3', description: 'Signal mast foundation at S-3 does not have grounding rod installed per electrical plan.', location: 'Signal Location S-3', status: 'resolved', priority: 'medium', assigned_to: 'prof-006', created_by: 'prof-009', due_date: '2026-02-21', resolved_date: '2026-02-20T00:00:00Z', verified_date: null, resolution_notes: 'Grounding rod installed and tested. Resistance measured at 18 ohms.', created_at: '2026-02-18T00:00:00Z' },
  { id: 'pl-018', project_id: 'proj-001', number: 'PL-018', title: 'Delineator posts damaged at access road', description: '3 delineator posts at construction zone access road are bent/damaged. Need replacement.', location: 'Main access road entrance', status: 'verified', priority: 'low', assigned_to: 'prof-008', created_by: 'prof-009', due_date: '2026-02-15', resolved_date: '2026-02-14T00:00:00Z', verified_date: '2026-02-19T00:00:00Z', resolution_notes: 'Replaced all 3 delineator posts.', created_at: '2026-02-10T00:00:00Z' },
];

// ============================================================
// MILESTONES (10)
// ============================================================
export const seedMilestones: Milestone[] = [
  { id: 'ms-001', project_id: 'proj-001', name: 'Mobilization & Site Prep', description: 'Equipment mobilization, temporary facilities, erosion control, and construction staking.', target_date: '2025-09-15', actual_date: '2025-09-12', status: 'complete', percent_complete: 100, budget_planned: 180000, budget_actual: 175000, sort_order: 1, linked_submittals: [], linked_rfis: [], created_at: '2025-08-26T00:00:00Z' },
  { id: 'ms-002', project_id: 'proj-001', name: 'Subgrade Preparation', description: 'Earthwork, unsuitable removal, geogrid installation, and subballast placement for all three sidings.', target_date: '2025-10-31', actual_date: '2025-11-05', status: 'complete', percent_complete: 100, budget_planned: 350000, budget_actual: 365000, sort_order: 2, linked_submittals: ['sub-004'], linked_rfis: ['rfi-009'], created_at: '2025-08-26T00:00:00Z' },
  { id: 'ms-003', project_id: 'proj-001', name: 'Siding 1 Track Installation', description: 'Tie placement, rail installation, ballast, tamping, and surfacing for Siding 1 (2,400 LF).', target_date: '2025-12-31', actual_date: null, status: 'on_track', percent_complete: 85, budget_planned: 520000, budget_actual: 480000, sort_order: 3, linked_submittals: ['sub-001', 'sub-002', 'sub-008', 'sub-011', 'sub-014'], linked_rfis: ['rfi-006'], created_at: '2025-08-26T00:00:00Z' },
  { id: 'ms-004', project_id: 'proj-001', name: 'Siding 2 Track Installation', description: 'Tie placement, rail installation, ballast, tamping, and surfacing for Siding 2 (2,200 LF).', target_date: '2026-01-31', actual_date: null, status: 'on_track', percent_complete: 45, budget_planned: 520000, budget_actual: 235000, sort_order: 4, linked_submittals: ['sub-001', 'sub-002'], linked_rfis: ['rfi-002'], created_at: '2025-08-26T00:00:00Z' },
  { id: 'ms-005', project_id: 'proj-001', name: 'Siding 3 Track Installation', description: 'Tie placement, rail installation, ballast, tamping, and surfacing for Siding 3 (2,000 LF). Includes #24 turnout.', target_date: '2026-02-15', actual_date: null, status: 'not_started', percent_complete: 0, budget_planned: 520000, budget_actual: 0, sort_order: 5, linked_submittals: ['sub-003', 'sub-010'], linked_rfis: ['rfi-004', 'rfi-005', 'rfi-010'], created_at: '2025-08-26T00:00:00Z' },
  { id: 'ms-006', project_id: 'proj-001', name: 'Signal Foundation & Conduit', description: 'Signal mast foundations, conduit installation, junction boxes, and cable pulls.', target_date: '2026-01-15', actual_date: null, status: 'at_risk', percent_complete: 60, budget_planned: 380000, budget_actual: 245000, sort_order: 6, linked_submittals: ['sub-005', 'sub-012'], linked_rfis: ['rfi-001', 'rfi-003'], created_at: '2025-08-26T00:00:00Z' },
  { id: 'ms-007', project_id: 'proj-001', name: 'Wayside Signal Installation', description: 'Signal mast erection, signal head mounting, wiring, and initial testing.', target_date: '2026-02-10', actual_date: null, status: 'behind', percent_complete: 20, budget_planned: 450000, budget_actual: 120000, sort_order: 7, linked_submittals: ['sub-006', 'sub-009', 'sub-015'], linked_rfis: ['rfi-008'], created_at: '2025-08-26T00:00:00Z' },
  { id: 'ms-008', project_id: 'proj-001', name: 'Grade Crossing Installation', description: 'Crossing surface, gate mechanisms, signals, interconnect, and advance warning signs at Main St.', target_date: '2026-02-20', actual_date: null, status: 'not_started', percent_complete: 0, budget_planned: 680000, budget_actual: 0, sort_order: 8, linked_submittals: ['sub-007', 'sub-013'], linked_rfis: ['rfi-007'], created_at: '2025-08-26T00:00:00Z' },
  { id: 'ms-009', project_id: 'proj-001', name: 'Testing & Commissioning', description: 'Signal system testing, track geometry verification, load testing, and system integration.', target_date: '2026-02-22', actual_date: null, status: 'not_started', percent_complete: 0, budget_planned: 320000, budget_actual: 0, sort_order: 9, linked_submittals: [], linked_rfis: [], created_at: '2025-08-26T00:00:00Z' },
  { id: 'ms-010', project_id: 'proj-001', name: 'Final Inspection & Closeout', description: 'Final walkthrough, punch list resolution, as-built drawings, O&M manuals, and owner training.', target_date: '2026-02-26', actual_date: null, status: 'not_started', percent_complete: 0, budget_planned: 280000, budget_actual: 0, sort_order: 10, linked_submittals: [], linked_rfis: [], created_at: '2025-08-26T00:00:00Z' },
];

// ============================================================
// ACTIVITY LOG (30 entries)
// ============================================================
export const seedActivityLog: ActivityLogEntry[] = [
  { id: 'act-001', project_id: 'proj-001', entity_type: 'submittal', entity_id: 'sub-006', action: 'submitted', description: 'LED Wayside Signal Heads submittal submitted for review', performed_by: 'prof-006', created_at: '2026-02-15T10:30:00Z' },
  { id: 'act-002', project_id: 'proj-001', entity_type: 'daily_log', entity_id: 'dl-025', action: 'created', description: 'Daily log created for Feb 20, 2026', performed_by: 'prof-003', created_at: '2026-02-20T17:00:00Z' },
  { id: 'act-003', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-015', action: 'created', description: 'Punch list item: Crossing surface panel gap exceeds spec', performed_by: 'prof-009', created_at: '2026-02-20T14:00:00Z' },
  { id: 'act-004', project_id: 'proj-001', entity_type: 'rfi', entity_id: 'rfi-008', action: 'created', description: 'RFI-008: Switch machine power supply routing', performed_by: 'prof-007', created_at: '2026-02-18T09:00:00Z' },
  { id: 'act-005', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-017', action: 'status_changed', description: 'Grounding rod at S-3 marked as resolved', performed_by: 'prof-006', created_at: '2026-02-20T11:00:00Z' },
  { id: 'act-006', project_id: 'proj-001', entity_type: 'submittal', entity_id: 'sub-012', action: 'submitted', description: 'Signal Cable - 16AWG Quad submittal submitted', performed_by: 'prof-007', created_at: '2026-02-18T08:30:00Z' },
  { id: 'act-007', project_id: 'proj-001', entity_type: 'daily_log', entity_id: 'dl-024', action: 'created', description: 'Daily log created for Feb 19, 2026', performed_by: 'prof-003', created_at: '2026-02-19T17:00:00Z' },
  { id: 'act-008', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-013', action: 'created', description: 'Anchor bolt torque below spec at S-1', performed_by: 'prof-009', created_at: '2026-02-19T10:00:00Z' },
  { id: 'act-009', project_id: 'proj-001', entity_type: 'rfi', entity_id: 'rfi-010', action: 'status_changed', description: 'RFI-010 answered: Track gauge tolerance at turnout', performed_by: 'prof-010', created_at: '2026-02-05T14:00:00Z' },
  { id: 'act-010', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-018', action: 'status_changed', description: 'Delineator posts marked as verified', performed_by: 'prof-009', created_at: '2026-02-19T15:00:00Z' },
  { id: 'act-011', project_id: 'proj-001', entity_type: 'submittal', entity_id: 'sub-013', action: 'submitted', description: 'Crossing Surface Panels submittal submitted', performed_by: 'prof-003', created_at: '2026-02-12T09:00:00Z' },
  { id: 'act-012', project_id: 'proj-001', entity_type: 'daily_log', entity_id: 'dl-023', action: 'created', description: 'Daily log created for Feb 18, 2026', performed_by: 'prof-003', created_at: '2026-02-18T17:00:00Z' },
  { id: 'act-013', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-009', action: 'created', description: 'Signal mast plumb out of tolerance at S-2', performed_by: 'prof-009', created_at: '2026-02-18T11:00:00Z' },
  { id: 'act-014', project_id: 'proj-001', entity_type: 'milestone', entity_id: 'ms-007', action: 'status_changed', description: 'Wayside Signal Installation status changed to Behind', performed_by: 'prof-001', created_at: '2026-02-17T09:00:00Z' },
  { id: 'act-015', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-010', action: 'status_changed', description: 'Track gauge tight — marked as resolved', performed_by: 'prof-003', created_at: '2026-02-17T16:00:00Z' },
  { id: 'act-016', project_id: 'proj-001', entity_type: 'daily_log', entity_id: 'dl-022', action: 'created', description: 'Daily log created for Feb 17, 2026', performed_by: 'prof-003', created_at: '2026-02-17T17:00:00Z' },
  { id: 'act-017', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-001', action: 'status_changed', description: 'Rail alignment at STA 9+25 marked as resolved', performed_by: 'prof-003', created_at: '2026-02-16T14:00:00Z' },
  { id: 'act-018', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-004', action: 'status_changed', description: 'Tie plate seating — marked as resolved', performed_by: 'prof-003', created_at: '2026-02-16T15:00:00Z' },
  { id: 'act-019', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-002', action: 'status_changed', description: 'Ballast shoulder verified by inspector', performed_by: 'prof-009', created_at: '2026-02-16T10:00:00Z' },
  { id: 'act-020', project_id: 'proj-001', entity_type: 'daily_log', entity_id: 'dl-021', action: 'created', description: 'Daily log created for Feb 16, 2026', performed_by: 'prof-003', created_at: '2026-02-16T17:00:00Z' },
  { id: 'act-021', project_id: 'proj-001', entity_type: 'submittal', entity_id: 'sub-015', action: 'created', description: 'Switch Heater System submittal drafted', performed_by: 'prof-006', created_at: '2026-02-25T08:00:00Z' },
  { id: 'act-022', project_id: 'proj-001', entity_type: 'rfi', entity_id: 'rfi-002', action: 'created', description: 'RFI-002: Track centerline elevation discrepancy', performed_by: 'prof-005', created_at: '2026-02-14T10:00:00Z' },
  { id: 'act-023', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-008', action: 'created', description: 'Ballast contamination at Siding 2', performed_by: 'prof-005', created_at: '2026-02-16T09:00:00Z' },
  { id: 'act-024', project_id: 'proj-001', entity_type: 'submittal', entity_id: 'sub-003', action: 'submitted', description: '#24 Turnout Assembly submitted for review', performed_by: 'prof-003', created_at: '2026-02-10T08:00:00Z' },
  { id: 'act-025', project_id: 'proj-001', entity_type: 'daily_log', entity_id: 'dl-020', action: 'created', description: 'Daily log created for Feb 13, 2026', performed_by: 'prof-003', created_at: '2026-02-13T17:00:00Z' },
  { id: 'act-026', project_id: 'proj-001', entity_type: 'submittal', entity_id: 'sub-007', action: 'submitted', description: 'Grade Crossing Gate Mechanisms submitted', performed_by: 'prof-006', created_at: '2026-02-05T09:00:00Z' },
  { id: 'act-027', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-012', action: 'status_changed', description: 'Thermite weld collar grinding verified', performed_by: 'prof-009', created_at: '2026-02-14T11:00:00Z' },
  { id: 'act-028', project_id: 'proj-001', entity_type: 'rfi', entity_id: 'rfi-007', action: 'created', description: 'RFI-007: Grade crossing signal timing requirements', performed_by: 'prof-006', created_at: '2026-02-10T11:00:00Z' },
  { id: 'act-029', project_id: 'proj-001', entity_type: 'milestone', entity_id: 'ms-006', action: 'updated', description: 'Signal Foundation & Conduit progress updated to 60%', performed_by: 'prof-001', created_at: '2026-02-14T08:00:00Z' },
  { id: 'act-030', project_id: 'proj-001', entity_type: 'punch_list', entity_id: 'pl-005', action: 'created', description: 'Drainage grade incorrect at STA 4+50', performed_by: 'prof-005', created_at: '2026-02-14T13:00:00Z' },
];

// ============================================================
// COMBINED EXPORT
// ============================================================
export const seedData = {
  project: seedProject,
  organizations: seedOrganizations,
  profiles: seedProfiles,
  projectMembers: seedProjectMembers,
  submittals: seedSubmittals,
  rfis: seedRFIs,
  dailyLogs: seedDailyLogs,
  punchListItems: seedPunchListItems,
  milestones: seedMilestones,
  activityLog: seedActivityLog,
};
