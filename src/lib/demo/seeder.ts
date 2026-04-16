'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import type { DemoPreset } from './types';

/**
 * Seed a complete demo project with all 12 modules of realistic railroad data.
 * Uses the service-role client to bypass RLS during setup.
 *
 * Returns the demo_account record ID on success.
 */
export async function seedDemo(preset: DemoPreset): Promise<{ id: string; error?: string }> {
  const admin = createAdminClient();

  try {
    // ─── 1. Create auth users ───────────────────────────────────
    const createdUsers: { authId: string; email: string; fullName: string; orgRole: string; projectRole: string; isPrimary: boolean; password: string }[] = [];

    // Primary user
    const { data: primaryAuth, error: primaryAuthErr } = await admin.auth.admin.createUser({
      email: preset.primaryUser.email,
      password: preset.primaryUser.password,
      email_confirm: true,
      user_metadata: { full_name: preset.primaryUser.fullName },
    });
    if (primaryAuthErr) return { id: '', error: `Failed to create primary user: ${primaryAuthErr.message}` };

    createdUsers.push({
      authId: primaryAuth.user.id,
      email: preset.primaryUser.email,
      fullName: preset.primaryUser.fullName,
      orgRole: preset.primaryUser.orgRole,
      projectRole: preset.primaryUser.projectRole,
      isPrimary: true,
      password: preset.primaryUser.password,
    });

    // Team users
    if (preset.teamUsers) {
      for (const tu of preset.teamUsers) {
        const { data: teamAuth, error: teamAuthErr } = await admin.auth.admin.createUser({
          email: tu.email,
          password: tu.password,
          email_confirm: true,
          user_metadata: { full_name: tu.fullName },
        });
        if (teamAuthErr) return { id: '', error: `Failed to create team user ${tu.email}: ${teamAuthErr.message}` };

        createdUsers.push({
          authId: teamAuth.user.id,
          email: tu.email,
          fullName: tu.fullName,
          orgRole: tu.orgRole,
          projectRole: tu.projectRole,
          isPrimary: false,
          password: tu.password,
        });
      }
    }

    // ─── 2. Create organization ─────────────────────────────────
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({
        name: `${preset.companyName} (Demo)`,
        type: 'contractor',
        tier: 'enterprise',
      })
      .select()
      .single();
    if (orgErr) return { id: '', error: `Failed to create organization: ${orgErr.message}` };

    // ─── 3. Create profiles linked to auth users ────────────────
    const profileIds: string[] = [];
    for (const u of createdUsers) {
      const { data: profile, error: profErr } = await admin
        .from('profiles')
        .upsert({
          id: u.authId,
          email: u.email,
          full_name: u.fullName,
          phone: '',
          role: u.orgRole,
          organization_id: org.id,
          avatar_url: '',
        }, { onConflict: 'id' })
        .select()
        .single();
      if (profErr) return { id: '', error: `Failed to create profile for ${u.email}: ${profErr.message}` };
      profileIds.push(profile.id);
    }

    // Also create NPC team members (non-playable — no auth login)
    const npcMembers = generateNPCTeamMembers(org.id);
    for (const npc of npcMembers) {
      // Create auth user for NPC (needed for RLS FK refs)
      const { data: npcAuth, error: npcAuthErr } = await admin.auth.admin.createUser({
        email: npc.email,
        password: `NPC-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        email_confirm: true,
        user_metadata: { full_name: npc.fullName },
      });
      if (npcAuthErr) continue; // Skip NPC if creation fails

      await admin.from('profiles').upsert({
        id: npcAuth.user.id,
        email: npc.email,
        full_name: npc.fullName,
        phone: npc.phone,
        role: npc.orgRole,
        organization_id: npc.orgId,
        avatar_url: '',
      }, { onConflict: 'id' });

      profileIds.push(npcAuth.user.id);
      npc.resolvedId = npcAuth.user.id;
    }

    // ─── 4. Create project ──────────────────────────────────────
    const primaryProfileId = createdUsers[0].authId;
    const { data: project, error: projErr } = await admin
      .from('projects')
      .insert({
        organization_id: org.id,
        name: preset.project.name,
        description: preset.project.description,
        status: 'active',
        start_date: preset.project.startDate,
        target_end_date: preset.project.targetEndDate,
        actual_end_date: null,
        budget_total: preset.project.budgetTotal,
        budget_spent: preset.project.budgetSpent,
        location: preset.project.location,
        client: preset.project.client,
        created_by: primaryProfileId,
      })
      .select()
      .single();
    if (projErr) return { id: '', error: `Failed to create project: ${projErr.message}` };

    // ─── 5. Add project members ─────────────────────────────────
    const allMembers: { profileId: string; projectRole: string; canEdit: boolean }[] = [];

    for (const u of createdUsers) {
      allMembers.push({
        profileId: u.authId,
        projectRole: u.projectRole,
        canEdit: ['manager', 'superintendent', 'foreman', 'engineer'].includes(u.projectRole),
      });
    }

    // NPC members with roles
    const npcRoles: ('foreman' | 'contractor' | 'inspector' | 'engineer')[] = ['foreman', 'contractor', 'inspector', 'engineer', 'contractor', 'foreman', 'contractor'];
    for (let i = 0; i < npcMembers.length && i < npcRoles.length; i++) {
      if (npcMembers[i].resolvedId) {
        allMembers.push({
          profileId: npcMembers[i].resolvedId!,
          projectRole: npcRoles[i],
          canEdit: ['foreman', 'engineer'].includes(npcRoles[i]),
        });
      }
    }

    for (const m of allMembers) {
      await admin.from('project_members').insert({
        project_id: project.id,
        profile_id: m.profileId,
        project_role: m.projectRole,
        can_edit: m.canEdit,
      });
    }

    // Collect profile IDs for data attribution
    const teamIds = allMembers.map(m => m.profileId);
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    // ─── 6. Seed milestones ─────────────────────────────────────
    const milestoneData = generateMilestones(project.id, preset);
    const { data: milestones } = await admin
      .from('milestones')
      .insert(milestoneData)
      .select();
    const milestoneIds = (milestones ?? []).map((m: any) => m.id);

    // ─── 7. Seed submittals ─────────────────────────────────────
    const submittalData = generateSubmittals(project.id, teamIds, milestoneIds, preset);
    await admin.from('submittals').insert(submittalData);

    // ─── 8. Seed RFIs ───────────────────────────────────────────
    const rfiData = generateRFIs(project.id, teamIds, milestoneIds, preset);
    await admin.from('rfis').insert(rfiData);

    // ─── 9. Seed daily logs ─────────────────────────────────────
    const dailyLogData = generateDailyLogs(project.id, teamIds, preset);
    for (const log of dailyLogData) {
      const { personnel, equipment, work_items, ...logCore } = log;
      const { data: insertedLog } = await admin.from('daily_logs').insert(logCore).select().single();
      if (insertedLog) {
        if (personnel.length > 0) {
          await admin.from('daily_log_personnel').insert(
            personnel.map((p: any) => ({ ...p, daily_log_id: insertedLog.id }))
          );
        }
        if (equipment.length > 0) {
          await admin.from('daily_log_equipment').insert(
            equipment.map((e: any) => ({ ...e, daily_log_id: insertedLog.id }))
          );
        }
        if (work_items.length > 0) {
          await admin.from('daily_log_work_items').insert(
            work_items.map((w: any) => ({ ...w, daily_log_id: insertedLog.id }))
          );
        }
      }
    }

    // ─── 10. Seed punch list items ──────────────────────────────
    const punchData = generatePunchListItems(project.id, teamIds, preset);
    await admin.from('punch_list_items').insert(punchData);

    // ─── 11. Seed safety incidents ──────────────────────────────
    const safetyData = generateSafetyIncidents(project.id, teamIds, preset);
    await admin.from('safety_incidents').insert(safetyData);

    // ─── 12. Seed change orders ─────────────────────────────────
    const changeOrderData = generateChangeOrders(project.id, teamIds, milestoneIds, preset);
    await admin.from('change_orders').insert(changeOrderData);

    // ─── 13. Seed QC/QA reports ─────────────────────────────────
    const qcqaData = generateQCQAReports(project.id, teamIds, preset);
    await admin.from('qcqa_reports').insert(qcqaData);

    // ─── 14. Seed project documents ─────────────────────────────
    const docData = generateDocuments(project.id, teamIds, milestoneIds, preset);
    await admin.from('project_documents').insert(docData);

    // ─── 15. Seed weekly reports ────────────────────────────────
    const weeklyData = generateWeeklyReports(project.id, teamIds, preset);
    await admin.from('weekly_reports').insert(weeklyData);

    // ─── 16. Seed modifications ─────────────────────────────────
    const modData = generateModifications(project.id, teamIds, milestoneIds, preset);
    await admin.from('modifications').insert(modData);

    // ─── 17. Seed activity log ──────────────────────────────────
    const activityData = generateActivityLog(project.id, teamIds);
    await admin.from('activity_log').insert(activityData);

    // ─── 18. Create demo_accounts record ────────────────────────
    const { data: demoAccount, error: demoErr } = await admin
      .from('demo_accounts')
      .insert({
        slug: preset.slug,
        company_name: preset.companyName,
        description: preset.description,
        organization_id: org.id,
        project_id: project.id,
        demo_user_id: primaryProfileId,
        is_active: true,
        is_team_demo: preset.isTeamDemo,
        demo_password: preset.primaryUser.password,
      })
      .select()
      .single();
    if (demoErr) return { id: '', error: `Failed to create demo account record: ${demoErr.message}` };

    // ─── 18. Create team login records (for team demos) ─────────
    if (preset.isTeamDemo && preset.teamUsers) {
      for (let i = 0; i < preset.teamUsers.length; i++) {
        const tu = preset.teamUsers[i];
        const cu = createdUsers[i + 1]; // +1 because index 0 is primary
        await admin.from('demo_team_logins').insert({
          demo_account_id: demoAccount.id,
          profile_id: cu.authId,
          email: tu.email,
          display_name: tu.fullName,
          project_role: tu.projectRole,
          demo_password: tu.password,
        });
      }
    }

    return { id: demoAccount.id };
  } catch (err) {
    return { id: '', error: err instanceof Error ? err.message : 'Unknown seeder error' };
  }
}

// ═══════════════════════════════════════════════════════════════
// DATA GENERATORS
// ═══════════════════════════════════════════════════════════════

interface NPCMember {
  email: string;
  fullName: string;
  phone: string;
  orgRole: string;
  orgId: string;
  resolvedId?: string;
}

function generateNPCTeamMembers(orgId: string): NPCMember[] {
  return [
    { email: `npc-foreman-${Date.now()}@demo.railcommand.app`, fullName: 'Bobby Hernandez', phone: '(720) 555-0201', orgRole: 'member', orgId },
    { email: `npc-contractor-${Date.now()}a@demo.railcommand.app`, fullName: 'Travis Mitchell', phone: '(720) 555-0202', orgRole: 'member', orgId },
    { email: `npc-inspector-${Date.now()}@demo.railcommand.app`, fullName: 'Patricia Morrison', phone: '(303) 555-0501', orgRole: 'viewer', orgId },
    { email: `npc-engineer-${Date.now()}@demo.railcommand.app`, fullName: 'Dr. Nathan Park', phone: '(303) 555-0601', orgRole: 'manager', orgId },
    { email: `npc-contractor-${Date.now()}b@demo.railcommand.app`, fullName: 'Derek Washington', phone: '(303) 555-0301', orgRole: 'member', orgId },
    { email: `npc-foreman2-${Date.now()}@demo.railcommand.app`, fullName: 'Jake Turner', phone: '(719) 555-0401', orgRole: 'member', orgId },
    { email: `npc-contractor-${Date.now()}c@demo.railcommand.app`, fullName: 'Amy Larson', phone: '(720) 555-0203', orgRole: 'member', orgId },
  ];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function dateStr(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pad(n: number): string {
  return String(n).padStart(3, '0');
}

// ─── Milestones ─────────────────────────────────────────────────
function generateMilestones(projectId: string, preset: DemoPreset) {
  const milestones = [
    { name: 'Mobilization & Site Prep', description: 'Equipment staging, survey verification, erosion controls', target_date: dateStr(-120), actual_date: dateStr(-118), status: 'complete', percent_complete: 100, budget_planned: preset.project.budgetTotal * 0.05, budget_actual: preset.project.budgetTotal * 0.048, sort_order: 1 },
    { name: 'Earthwork & Subgrade', description: 'Grading, subballast placement, drainage installation', target_date: dateStr(-90), actual_date: dateStr(-88), status: 'complete', percent_complete: 100, budget_planned: preset.project.budgetTotal * 0.12, budget_actual: preset.project.budgetTotal * 0.125, sort_order: 2 },
    { name: 'Track Construction — Main Line', description: 'Rail installation, tie placement, ballast, surfacing on mainline segments', target_date: dateStr(-45), actual_date: dateStr(-42), status: 'complete', percent_complete: 100, budget_planned: preset.project.budgetTotal * 0.25, budget_actual: preset.project.budgetTotal * 0.26, sort_order: 3 },
    { name: 'Track Construction — Sidings', description: 'Siding track installation, turnouts, ballast', target_date: dateStr(-15), actual_date: null, status: 'at_risk', percent_complete: 78, budget_planned: preset.project.budgetTotal * 0.18, budget_actual: preset.project.budgetTotal * 0.17, sort_order: 4 },
    { name: 'Turnout Installation', description: '#24 turnout assemblies, frog installation, switch ties', target_date: dateStr(10), actual_date: null, status: 'on_track', percent_complete: 45, budget_planned: preset.project.budgetTotal * 0.08, budget_actual: preset.project.budgetTotal * 0.04, sort_order: 5 },
    { name: 'Signal Foundations', description: 'Signal mast foundations, cable trench, conduit', target_date: dateStr(25), actual_date: null, status: 'on_track', percent_complete: 30, budget_planned: preset.project.budgetTotal * 0.06, budget_actual: preset.project.budgetTotal * 0.02, sort_order: 6 },
    { name: 'Signal & Communication Systems', description: 'Wayside signals, switch machines, CTC integration', target_date: dateStr(55), actual_date: null, status: 'not_started', percent_complete: 0, budget_planned: preset.project.budgetTotal * 0.12, budget_actual: 0, sort_order: 7 },
    { name: 'Grade Crossing Protection', description: 'Gate mechanisms, flash signals, preemption integration', target_date: dateStr(70), actual_date: null, status: 'not_started', percent_complete: 0, budget_planned: preset.project.budgetTotal * 0.06, budget_actual: 0, sort_order: 8 },
    { name: 'Testing & Commissioning', description: 'FRA testing, signal cutover, speed restrictions lifted', target_date: dateStr(85), actual_date: null, status: 'not_started', percent_complete: 0, budget_planned: preset.project.budgetTotal * 0.04, budget_actual: 0, sort_order: 9 },
    { name: 'Final Inspection & Closeout', description: 'Final walkthrough, punch list completion, as-builts', target_date: dateStr(100), actual_date: null, status: 'not_started', percent_complete: 0, budget_planned: preset.project.budgetTotal * 0.04, budget_actual: 0, sort_order: 10 },
  ];

  return milestones.map(m => ({ project_id: projectId, ...m }));
}

// ─── Submittals ─────────────────────────────────────────────────
function generateSubmittals(projectId: string, teamIds: string[], milestoneIds: string[], _preset: DemoPreset) {
  const statuses: ('draft' | 'submitted' | 'under_review' | 'approved' | 'conditional' | 'rejected')[] = ['approved', 'approved', 'approved', 'approved', 'conditional', 'submitted', 'under_review', 'under_review', 'rejected', 'draft', 'approved', 'submitted', 'under_review', 'conditional', 'approved'];

  const submittals = [
    { title: '136RE Rail — Continuous Welded', spec_section: '34 11 13 - Track Construction', description: 'Shop drawings and mill certifications for 136RE continuous welded rail per AREMA specifications.' },
    { title: 'Concrete Ties — Type III Pre-stressed', spec_section: '34 11 13 - Track Construction', description: 'Product data and test reports for Type III pre-stressed concrete ties.' },
    { title: '#24 Turnout Assembly', spec_section: '34 11 16 - Turnouts and Crossings', description: 'Complete fabrication drawings for #24 turnout including frog, switch points, closure rails.' },
    { title: 'AREMA #4 Ballast Material', spec_section: '34 11 13 - Track Construction', description: 'Gradation test results and source quarry documentation for AREMA #4 ballast material.' },
    { title: 'Signal Mast Foundations', spec_section: '34 42 13 - Signal Systems', description: 'Structural calculations and shop drawings for signal mast foundations.' },
    { title: 'LED Wayside Signal Heads', spec_section: '34 42 13 - Signal Systems', description: 'Product data, photometric reports, and color chromaticity data for LED wayside signals.' },
    { title: 'Grade Crossing Gate Mechanisms', spec_section: '34 42 16 - Grade Crossing Protection', description: 'Shop drawings for gate mechanisms including motor assemblies and counterweights.' },
    { title: 'Insulated Rail Joints', spec_section: '34 11 13 - Track Construction', description: 'Product data for insulated rail joints with adhesive specifications and testing certs.' },
    { title: 'Switch Machine — SE-17 Electric', spec_section: '34 42 13 - Signal Systems', description: 'Product data and installation manual for SE-17 electric switch machines.' },
    { title: 'Track Drainage Plan', spec_section: '33 40 00 - Storm Drainage', description: 'Drainage design showing track subgrade drainage and cross-drain locations.' },
    { title: 'Ballast Tamping Procedures', spec_section: '34 11 13 - Track Construction', description: 'Tamping procedures and equipment specifications per AREMA standards.' },
    { title: 'Signal Cable — 16AWG Quad', spec_section: '34 42 13 - Signal Systems', description: 'Product data for 16AWG quad signal cable with burial specifications.' },
    { title: 'Crossing Surface Panels — Rubber', spec_section: '34 42 16 - Grade Crossing Protection', description: 'Product data and installation details for rubber grade crossing surface panels.' },
    { title: 'Rail Welding Procedures', spec_section: '34 11 13 - Track Construction', description: 'Welding procedure specifications for thermite and flash butt welding of 136RE rail.' },
    { title: 'Switch Heater System', spec_section: '34 42 13 - Signal Systems', description: 'Product data for electric switch heater system with power requirements.' },
  ];

  return submittals.map((s, i) => {
    const status = statuses[i];
    const isReviewed = ['approved', 'conditional', 'rejected'].includes(status);
    return {
      project_id: projectId,
      number: `SUB-${pad(i + 1)}`,
      title: s.title,
      description: s.description,
      spec_section: s.spec_section,
      status,
      submitted_by: pick(teamIds),
      reviewed_by: isReviewed ? pick(teamIds) : null,
      submit_date: daysAgo(120 - i * 7),
      due_date: dateStr(-120 + i * 7 + 14),
      review_date: isReviewed ? daysAgo(120 - i * 7 - 5) : null,
      review_notes: isReviewed ? 'Reviewed per project specifications.' : null,
      milestone_id: milestoneIds.length > 0 ? milestoneIds[i % milestoneIds.length] : null,
    };
  });
}

// ─── RFIs ───────────────────────────────────────────────────────
function generateRFIs(projectId: string, teamIds: string[], milestoneIds: string[], _preset: DemoPreset) {
  const rfis = [
    { subject: 'Utility Conflict at STA 24+50', question: 'Existing 8" gas main not shown on plans at STA 24+50. Requesting field verification and potential realignment.', priority: 'high' as const },
    { subject: 'Rail Elevation Discrepancy — Siding 2', question: 'Survey shows 0.3ft elevation difference from design at STA 18+00 on Siding 2. Clarify if re-grading is required.', priority: 'medium' as const },
    { subject: 'Foundation Depth — Frost Line', question: 'Specified 4ft foundation depth may be insufficient given local frost depth of 4.5ft. Request design clarification.', priority: 'high' as const },
    { subject: 'Ballast Substitution — Type 2 vs Type 3', question: 'Type 3 ballast specified but quarry availability limited. Can Type 2 AREMA ballast be used for yard lead tracks?', priority: 'medium' as const },
    { subject: 'Signal Cable Routing — Underground Conflict', question: 'Proposed cable route at crossing 3 conflicts with existing storm drain. Request alternate routing approval.', priority: 'medium' as const },
    { subject: 'Turnout Geometry Clarification', question: 'Drawing C-105 shows #20 turnout but spec calls for #24. Please confirm which is correct.', priority: 'critical' as const },
    { subject: 'Dewatering Requirements', question: 'Standing water at excavation STA 12+00 to 13+50. Are dewatering measures included in scope?', priority: 'high' as const },
    { subject: 'Crossing Surface Material Change', question: 'Rubber panels specified but concrete panels offer better lifecycle cost. Request consideration for substitution.', priority: 'low' as const },
    { subject: 'Track Gauge Tolerance — Curves', question: 'What gauge widening is acceptable on the 12-degree curve at STA 30+00?', priority: 'medium' as const },
    { subject: 'Environmental Buffer Zone', question: 'Wetland boundary appears within 25ft of proposed Siding 3. Confirm setback requirements.', priority: 'high' as const },
    { subject: 'Thermite Weld Spacing', question: 'Plans show 39ft rail strings but field conditions require cuts. Minimum spacing between thermite welds?', priority: 'medium' as const },
    { subject: 'PTC Integration Requirements', question: 'Signal design must interface with existing PTC system. Clarify protocol and handshake requirements.', priority: 'critical' as const },
  ];

  const statuses: ('open' | 'answered' | 'closed')[] = ['answered', 'answered', 'closed', 'answered', 'open', 'open', 'answered', 'closed', 'open', 'open', 'answered', 'open'];

  return rfis.map((r, i) => {
    const status = statuses[i];
    return {
      project_id: projectId,
      number: `RFI-${pad(i + 1)}`,
      subject: r.subject,
      question: r.question,
      answer: status !== 'open' ? 'Response provided per attached documentation. See engineer\'s response for details.' : null,
      status,
      priority: r.priority,
      submitted_by: pick(teamIds),
      assigned_to: pick(teamIds),
      submit_date: daysAgo(100 - i * 7),
      due_date: dateStr(-100 + i * 7 + 14),
      response_date: status !== 'open' ? daysAgo(100 - i * 7 - 4) : null,
      milestone_id: milestoneIds.length > 0 ? milestoneIds[i % milestoneIds.length] : null,
    };
  });
}

// ─── Daily Logs ─────────────────────────────────────────────────
function generateDailyLogs(projectId: string, teamIds: string[], _preset: DemoPreset) {
  const logs = [];
  const conditions = ['Clear', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Clear', 'Cloudy', 'Clear'];
  const summaries = [
    'Continued track laying on main line. Completed 400 LF of rail installation. Tamping crew followed behind.',
    'Ballast delivery and placement on Siding 1. 6 trucks delivered, 480 tons placed. Compaction testing passed.',
    'Turnout installation prep at Switch 4. Excavated foundation, placed subballast. Ready for assembly tomorrow.',
    'Signal conduit trenching from MP 2.1 to MP 2.4. Hit rock at 3ft depth, brought in rock hammer.',
    'Rail welding operations — completed 8 thermite welds on main line. All passed visual and ultrasonic testing.',
    'Grade crossing work at Oak Street. Removed existing asphalt, installed rubber crossing panels.',
    'Survey and staking for Siding 3 alignment. Resolved 0.15ft discrepancy with design team on-site.',
    'Concrete pour for signal mast foundations S-1 through S-3. Cylinders taken for 7-day break tests.',
    'Tie installation on Siding 2 — placed 320 concrete ties. Spacing verified at 24" centers per spec.',
    'Rain delay until 10:30 AM. Afternoon: completed ballast shouldering on main line STA 15+00 to 18+50.',
    'Switch machine installation at Turnout 1. Electrical connections pending signal contractor.',
    'Final surfacing and alignment on main line STA 0+00 to 8+00. Geometry car scheduled for next week.',
    'Cable pulling in signal conduit — 2,400ft of 16AWG quad cable installed between bungalows B-1 and B-2.',
    'Punch list walkthrough with inspector on completed Siding 1. 4 items identified, 2 resolved on-site.',
    'Equipment maintenance day. Tamper, regulator, and ballast train serviced. No production activities.',
    'Installed insulated joints at 6 locations on main line. Track circuit testing to follow.',
    'Erosion control inspection with environmental monitor. All BMPs in good condition.',
    'Rail destressing operations on main line — set neutral temperature at 95°F per spec.',
    'Signal testing on completed circuit 1-4. All aspects verified, switch correspondence confirmed.',
    'Crossing gate installation at Elm Street. Mechanical assembly complete, electrical pending.',
    'Delivered and staged 200 concrete ties for Siding 3. Stored per manufacturer requirements.',
    'Completed ballast undercutting at 3 locations to address fouled ballast conditions.',
    'Night work: track possession for mainline tie replacement at 4 locations.',
    'Safety stand-down meeting — reviewed fall protection and excavation procedures with all crews.',
    'Final walkthrough items on Siding 1 resolved. Ready for FRA pre-inspection.',
  ];

  for (let i = 0; i < 25; i++) {
    const dayOffset = i * 2 + (i > 15 ? 2 : 0); // Skip some weekends
    logs.push({
      project_id: projectId,
      log_date: dateStr(-60 + dayOffset),
      created_by: pick(teamIds),
      weather_temp: 35 + Math.floor(Math.random() * 40),
      weather_conditions: conditions[i % conditions.length],
      weather_wind: `${5 + Math.floor(Math.random() * 15)} mph ${pick(['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE'])}`,
      work_summary: summaries[i % summaries.length],
      safety_notes: i % 5 === 0 ? 'Toolbox talk conducted. No incidents reported.' : '',
      personnel: [
        { role: 'Track Laborers', headcount: 6 + Math.floor(Math.random() * 4), company: 'Mountain West Track' },
        { role: 'Equipment Operators', headcount: 2 + Math.floor(Math.random() * 3), company: 'Mountain West Track' },
        { role: 'Signal Technicians', headcount: i > 12 ? 2 + Math.floor(Math.random() * 2) : 0, company: 'Front Range Signal' },
      ].filter(p => p.headcount > 0),
      equipment: [
        { equipment_type: 'Ballast Tamper', count: 1, notes: 'Operating' },
        { equipment_type: 'Ballast Regulator', count: 1, notes: i % 3 === 0 ? 'Down for maintenance' : 'Operating' },
        { equipment_type: 'Excavator (Cat 320)', count: 1, notes: 'Operating' },
        { equipment_type: 'Dump Trucks', count: 2 + Math.floor(Math.random() * 3), notes: 'Hauling ballast' },
      ],
      work_items: [
        { description: summaries[i % summaries.length].split('.')[0], quantity: 100 + Math.floor(Math.random() * 400), unit: 'LF', location: `STA ${10 + i}+00 to ${12 + i}+00` },
      ],
    });
  }
  return logs;
}

// ─── Punch List ─────────────────────────────────────────────────
function generatePunchListItems(projectId: string, teamIds: string[], _preset: DemoPreset) {
  const items = [
    { title: 'Rail joint gap exceeds tolerance at STA 14+22', location: 'Main Line STA 14+22', priority: 'high' as const },
    { title: 'Missing reflector on Switch 4 point', location: 'Switch 4 — East Siding', priority: 'critical' as const },
    { title: 'Ballast shoulder width insufficient at curve', location: 'Main Line STA 28+00 to 29+50', priority: 'medium' as const },
    { title: 'Tie plate not seated — Siding 1 #47', location: 'Siding 1 — Tie #47', priority: 'medium' as const },
    { title: 'Drainage inlet clogged with construction debris', location: 'STA 20+00 — South side', priority: 'high' as const },
    { title: 'Signal conduit exposed above grade', location: 'Signal Bungalow B-1 to MP 2.2', priority: 'medium' as const },
    { title: 'Gauge tight at crossing approach', location: 'Oak Street Crossing — East approach', priority: 'high' as const },
    { title: 'Spalled concrete tie — replace', location: 'Siding 2 — Tie #112', priority: 'low' as const },
    { title: 'OTM fastener torque below spec', location: 'Main Line STA 6+00 to 7+50', priority: 'medium' as const },
    { title: 'Paint markings faded on rail clips', location: 'Siding 1 — Full length', priority: 'low' as const },
    { title: 'Derail device mounting bolts loose', location: 'Siding 2 — West end', priority: 'critical' as const },
    { title: 'Ballast fouling at sub-drain outlet', location: 'STA 16+50 — North side', priority: 'medium' as const },
    { title: 'Switch point worn beyond tolerance', location: 'Turnout 2 — Main Line', priority: 'high' as const },
    { title: 'Crossing surface panel gap > 2"', location: 'Elm Street Crossing', priority: 'medium' as const },
    { title: 'Thermite weld collar not ground flush', location: 'Main Line STA 22+30', priority: 'low' as const },
    { title: 'Signal cable junction box lid missing', location: 'Junction Box JB-04', priority: 'medium' as const },
    { title: 'Grade crossing flasher alignment off', location: 'Oak Street Crossing', priority: 'high' as const },
    { title: 'Missing spike on every 4th tie', location: 'Siding 3 STA 0+00 to 2+00', priority: 'medium' as const },
    { title: 'Track geometry — cross-level out of spec', location: 'Main Line STA 30+00', priority: 'high' as const },
    { title: 'Erosion control blanket displaced', location: 'STA 8+00 — Cut slope', priority: 'low' as const },
  ];

  const statuses: ('open' | 'in_progress' | 'resolved' | 'verified')[] = [
    'verified', 'resolved', 'verified', 'in_progress', 'verified',
    'resolved', 'open', 'verified', 'in_progress', 'verified',
    'open', 'resolved', 'open', 'in_progress', 'verified',
    'open', 'open', 'resolved', 'open', 'verified',
  ];

  return items.map((item, i) => {
    const status = statuses[i];
    return {
      project_id: projectId,
      number: `PL-${pad(i + 1)}`,
      title: item.title,
      description: `Deficiency identified during field inspection. ${item.title}. Requires correction per project specifications.`,
      location: item.location,
      status,
      priority: item.priority,
      assigned_to: pick(teamIds),
      created_by: pick(teamIds),
      due_date: dateStr(-30 + i * 3),
      resolved_date: ['resolved', 'verified'].includes(status) ? daysAgo(20 - i) : null,
      verified_date: status === 'verified' ? daysAgo(15 - i) : null,
      resolution_notes: ['resolved', 'verified'].includes(status) ? 'Corrected per specification requirements. Verified by inspector.' : null,
    };
  });
}

// ─── Safety Incidents ───────────────────────────────────────────
function generateSafetyIncidents(projectId: string, teamIds: string[], _preset: DemoPreset) {
  const incidents = [
    { title: 'Near miss — dump truck backing near workers', type: 'near_miss' as const, severity: 'high' as const, location: 'Staging area — East lot' },
    { title: 'First aid — splinter from railroad tie', type: 'first_aid' as const, severity: 'low' as const, location: 'Siding 1 — Tie installation zone' },
    { title: 'Tripping hazard — unsecured cable across walkway', type: 'hazard' as const, severity: 'medium' as const, location: 'Signal Bungalow B-2 area' },
    { title: 'Observation — PPE compliance check', type: 'observation' as const, severity: 'low' as const, location: 'All zones — Morning inspection' },
    { title: 'Recordable — hand laceration from rail clip', type: 'recordable' as const, severity: 'high' as const, location: 'Main Line STA 10+00' },
    { title: 'Near miss — excavator swing radius', type: 'near_miss' as const, severity: 'critical' as const, location: 'Foundation excavation area' },
    { title: 'Hazard — unprotected excavation edge', type: 'hazard' as const, severity: 'high' as const, location: 'Signal trench STA 24+00' },
    { title: 'First aid — heat stress symptoms', type: 'first_aid' as const, severity: 'medium' as const, location: 'Track laying zone — Main Line' },
  ];

  const statuses: ('open' | 'in_progress' | 'resolved' | 'closed')[] = [
    'closed', 'closed', 'resolved', 'closed', 'in_progress', 'resolved', 'open', 'closed',
  ];

  return incidents.map((inc, i) => ({
    project_id: projectId,
    number: `SAF-${pad(i + 1)}`,
    reported_by: pick(teamIds),
    incident_date: dateStr(-50 + i * 6),
    title: inc.title,
    description: `${inc.title}. Investigation and corrective measures documented below.`,
    incident_type: inc.type,
    severity: inc.severity,
    status: statuses[i],
    location: inc.location,
    personnel_involved: i % 2 === 0 ? 'Mountain West Track crew' : 'Front Range Signal crew',
    root_cause: statuses[i] !== 'open' ? 'Root cause analysis completed. See corrective action for details.' : '',
    corrective_action: statuses[i] !== 'open' ? 'Corrective measures implemented. Toolbox talk conducted with affected crews.' : '',
  }));
}

// ─── Change Orders ──────────────────────────────────────────────
function generateChangeOrders(projectId: string, teamIds: string[], milestoneIds: string[], preset: DemoPreset) {
  const orders = [
    { title: 'Unforeseen Rock Excavation — STA 12+00', reason: 'Subsurface rock discovered during signal trench excavation. Rock hammer and disposal required.', amount: 45000 },
    { title: 'Turnout Upgrade — #20 to #24', reason: 'Design revision: upgrade main line turnouts from #20 to #24 per operational requirements.', amount: 78000 },
    { title: 'Additional Ballast — Fouled Subgrade', reason: 'Existing subgrade at Siding 2 found to be contaminated. Additional ballast depth required.', amount: 32000 },
    { title: 'Signal System Scope Addition — PTC Interface', reason: 'Owner directive: integrate PTC wayside interface equipment at all signal locations.', amount: 125000 },
    { title: 'Credit — Concrete Tie Substitution', reason: 'Approved substitution of wood ties for concrete ties on low-speed yard tracks. Credit issued.', amount: -18000 },
  ];

  const statuses: ('approved' | 'submitted' | 'draft' | 'approved' | 'approved')[] = ['approved', 'submitted', 'draft', 'approved', 'approved'];

  return orders.map((co, i) => ({
    project_id: projectId,
    number: `CO-${pad(i + 1)}`,
    title: co.title,
    description: co.reason,
    reason: co.reason,
    amount: co.amount,
    status: statuses[i],
    submitted_by: pick(teamIds),
    approved_by: statuses[i] === 'approved' ? pick(teamIds) : null,
    linked_milestone_id: milestoneIds.length > 0 ? milestoneIds[i % milestoneIds.length] : null,
    submit_date: daysAgo(60 - i * 10),
    approval_date: statuses[i] === 'approved' ? daysAgo(55 - i * 10) : null,
  }));
}

// ─── QC/QA Reports ──────────────────────────────────────────────
function generateQCQAReports(projectId: string, teamIds: string[], _preset: DemoPreset) {
  const reports = [
    { title: 'Track Gauge Inspection — Main Line', type: 'inspection' as const, spec: '34 11 13 - Section 3.1', findings: 'Gauge within tolerance (56.5" ± 0.25") at all measured points. 48 measurements taken.' },
    { title: 'Ballast Gradation Test — Lot 3', type: 'test' as const, spec: '34 11 13 - Section 2.3', findings: 'Gradation meets AREMA #4 specification. Sieve analysis results attached.' },
    { title: 'NCR: Concrete Tie Cracking — Siding 1', type: 'nonconformance' as const, spec: '34 11 13 - Section 2.2', findings: 'Three concrete ties with visible cracks exceeding 0.010" width. Replacement required.' },
    { title: 'Thermite Weld Inspection', type: 'inspection' as const, spec: '34 11 13 - Section 3.4', findings: 'Visual and ultrasonic testing of 12 thermite welds. All pass. UT reports attached.' },
    { title: 'Signal Foundation Concrete Strength', type: 'test' as const, spec: '34 42 13 - Section 2.1', findings: '7-day break test results: 4,200 PSI average (spec: 3,500 PSI min). All cylinders pass.' },
    { title: 'QMS Audit — Document Control', type: 'audit' as const, spec: 'QMS-001 - Section 4', findings: 'All submittals tracked. 2 minor findings: late log entries for RFI-005 and RFI-008.' },
    { title: 'Rail Profile Measurement', type: 'inspection' as const, spec: '34 11 13 - Section 3.5', findings: 'Rail profile measurements taken at 50ft intervals. Head wear within Class 4 limits.' },
    { title: 'NCR: Ballast Contamination — STA 16+50', type: 'nonconformance' as const, spec: '34 11 13 - Section 2.3', findings: 'Ballast contamination from subgrade migration. Geotextile and clean ballast replacement required.' },
  ];

  const statuses: ('closed' | 'closed' | 'open' | 'closed' | 'closed' | 'in_review' | 'closed' | 'open')[] = ['closed', 'closed', 'open', 'closed', 'closed', 'in_review', 'closed', 'open'];

  return reports.map((r, i) => ({
    project_id: projectId,
    number: `QC-${pad(i + 1)}`,
    report_type: r.type,
    title: r.title,
    description: r.findings,
    spec_reference: r.spec,
    location: `Project site — ${pick(['Main Line', 'Siding 1', 'Siding 2', 'Signal Area'])}`,
    status: statuses[i],
    findings: r.findings,
    corrective_action: r.type === 'nonconformance' ? 'Corrective action initiated. See attached disposition report.' : '',
    is_nonconformance: r.type === 'nonconformance',
    severity: r.type === 'nonconformance' ? ('major' as const) : ('minor' as const),
    inspector: pick(teamIds),
    linked_punch_list_ids: [],
    closed_by: statuses[i] === 'closed' ? pick(teamIds) : null,
    closed_date: statuses[i] === 'closed' ? daysAgo(10 + i * 3) : null,
  }));
}

// ─── Documents ──────────────────────────────────────────────────
function generateDocuments(projectId: string, teamIds: string[], milestoneIds: string[], _preset: DemoPreset) {
  const docs = [
    { title: 'Track Plan — Sheet C-101', category: 'drawing' as const, revision: 'Rev 2', fileName: 'C-101_Track_Plan_Rev2.pdf' },
    { title: 'Signal Layout — Sheet E-201', category: 'drawing' as const, revision: 'Rev 1', fileName: 'E-201_Signal_Layout_Rev1.pdf' },
    { title: 'Project Specifications — Division 34', category: 'specification' as const, revision: 'Rev 0', fileName: 'Div34_Specifications.pdf' },
    { title: 'Geotechnical Report', category: 'report' as const, revision: 'Rev 0', fileName: 'Geotech_Report_2025.pdf' },
    { title: 'Prime Contract — A5 Rail / Client', category: 'contract' as const, revision: 'Rev 0', fileName: 'Prime_Contract_Executed.pdf' },
    { title: 'Subcontract — Front Range Signal', category: 'contract' as const, revision: 'Rev 1', fileName: 'Sub_FrontRange_Signal_Rev1.pdf' },
    { title: 'Environmental Monitoring Plan', category: 'report' as const, revision: 'Rev 0', fileName: 'Environmental_Monitoring_Plan.pdf' },
    { title: 'Grade Crossing Detail — Oak Street', category: 'drawing' as const, revision: 'Rev 3', fileName: 'C-301_GradeCrossing_OakSt_Rev3.pdf' },
    { title: 'RFI Response Log', category: 'correspondence' as const, revision: 'Rev 5', fileName: 'RFI_Response_Log_Current.xlsx' },
    { title: 'Monthly Progress Photos — Feb 2026', category: 'photo_log' as const, revision: 'Rev 0', fileName: 'Progress_Photos_Feb2026.pdf' },
  ];

  const statuses: ('approved' | 'issued' | 'approved' | 'approved' | 'approved' | 'issued' | 'approved' | 'under_review' | 'issued' | 'draft')[] = [
    'approved', 'issued', 'approved', 'approved', 'approved', 'issued', 'approved', 'under_review', 'issued', 'draft',
  ];

  return docs.map((d, i) => ({
    project_id: projectId,
    number: `DOC-${pad(i + 1)}`,
    title: d.title,
    description: `${d.title} — project document for ${_preset.project.name}.`,
    category: d.category,
    status: statuses[i],
    revision: d.revision,
    revision_date: dateStr(-90 + i * 8),
    file_name: d.fileName,
    file_url: '',
    file_size: 500000 + Math.floor(Math.random() * 5000000),
    uploaded_by: pick(teamIds),
    reviewed_by: statuses[i] === 'approved' ? pick(teamIds) : null,
    review_date: statuses[i] === 'approved' ? dateStr(-85 + i * 8) : null,
    linked_milestone_id: milestoneIds.length > 0 ? milestoneIds[i % milestoneIds.length] : null,
  }));
}

// ─── Weekly Reports ─────────────────────────────────────────────
function generateWeeklyReports(projectId: string, teamIds: string[], _preset: DemoPreset) {
  const reports = [];
  for (let week = 0; week < 8; week++) {
    const weekStart = dateStr(-60 + week * 7);
    const weekEnd = dateStr(-54 + week * 7);
    const isCM = week % 2 === 0;

    reports.push({
      project_id: projectId,
      number: `WR-${pad(week + 1)}`,
      report_type: isCM ? 'cm' as const : 'contractor' as const,
      week_start_date: weekStart,
      week_end_date: weekEnd,
      title: `${isCM ? 'CM' : 'Contractor'} Weekly Report — Week of ${weekStart}`,
      status: week < 6 ? 'approved' as const : week < 7 ? 'submitted' as const : 'draft' as const,
      work_summary: `Week ${week + 1}: Continued track and signal work per schedule. ${isCM ? 'CM oversight activities included daily inspections and quality verification.' : 'Contractor production met or exceeded targets for the week.'}`,
      safety_summary: 'No recordable incidents this week. Toolbox talks conducted daily. PPE compliance at 100%.',
      schedule_summary: week < 4 ? 'On schedule. All milestone targets being met.' : 'Siding 2 track work 3 days behind due to material delivery delay. Recovery plan in place.',
      issues_concerns: week > 3 ? 'Ballast supplier experiencing transportation delays. Monitoring closely.' : 'No significant issues this week.',
      upcoming_work: 'Continue track installation, begin signal cable pulling on completed segments.',
      weather_summary: `Temperatures ranged from ${30 + week * 3}°F to ${50 + week * 3}°F. ${week % 3 === 0 ? 'One rain day lost.' : 'No weather delays.'}`,
      manpower_total: 18 + Math.floor(Math.random() * 8),
      equipment_hours: 120 + Math.floor(Math.random() * 80),
      submitted_by: pick(teamIds),
      approved_by: week < 6 ? pick(teamIds) : null,
      submit_date: daysAgo(54 - week * 7),
      approval_date: week < 6 ? daysAgo(52 - week * 7) : null,
    });
  }
  return reports;
}

// ─── Modifications ──────────────────────────────────────────────
function generateModifications(projectId: string, teamIds: string[], milestoneIds: string[], _preset: DemoPreset) {
  const mods = [
    { title: 'Plan Revision — Siding 2 Alignment Shift', type: 'plan_revision' as const, desc: 'Shift Siding 2 alignment 3ft south to avoid utility conflict discovered during construction.', affected: 'Sheets C-102, C-103, C-104' },
    { title: 'Specification Amendment — Ballast Depth', type: 'spec_amendment' as const, desc: 'Increase minimum ballast depth from 12" to 15" on all yard tracks per owner directive.', affected: 'Specification Section 34 11 13, Para 2.3' },
    { title: 'Design Change — Signal Mast Heights', type: 'design_change' as const, desc: 'Increase signal mast heights by 2ft at locations S-4 and S-5 for sight distance compliance.', affected: 'Sheets E-201, E-202, Structural Calculations' },
    { title: 'Contract Amendment — Schedule Extension', type: 'contract_amendment' as const, desc: '30-day schedule extension granted due to unforeseen rock excavation and utility conflicts.', affected: 'Contract Section 00700 - General Conditions' },
  ];

  const statuses: ('implemented' | 'acknowledged' | 'issued' | 'draft')[] = ['implemented', 'acknowledged', 'issued', 'draft'];

  return mods.map((m, i) => ({
    project_id: projectId,
    number: `MOD-${pad(i + 1)}`,
    title: m.title,
    description: m.desc,
    modification_type: m.type,
    status: statuses[i],
    revision_number: `Rev ${i}`,
    affected_documents: m.affected,
    issued_by: pick(teamIds),
    issued_date: daysAgo(40 - i * 10),
    effective_date: statuses[i] !== 'draft' ? dateStr(-35 + i * 10) : null,
    acknowledged_by: ['acknowledged', 'implemented'].includes(statuses[i]) ? pick(teamIds) : null,
    acknowledged_date: ['acknowledged', 'implemented'].includes(statuses[i]) ? daysAgo(35 - i * 10) : null,
    linked_milestone_id: milestoneIds.length > 0 ? milestoneIds[i % milestoneIds.length] : null,
  }));
}

// ─── Activity Log ───────────────────────────────────────────────
function generateActivityLog(projectId: string, teamIds: string[]) {
  const entries = [
    { entity_type: 'project', action: 'created', description: 'Project created' },
    { entity_type: 'milestone', action: 'created', description: 'Added milestone: Mobilization & Site Prep' },
    { entity_type: 'milestone', action: 'created', description: 'Added milestone: Earthwork & Subgrade' },
    { entity_type: 'milestone', action: 'created', description: 'Added milestone: Track Construction — Main Line' },
    { entity_type: 'submittal', action: 'created', description: 'Submitted SUB-001: 136RE Rail — Continuous Welded' },
    { entity_type: 'submittal', action: 'status_changed', description: 'SUB-001 status changed to approved' },
    { entity_type: 'submittal', action: 'created', description: 'Submitted SUB-002: Concrete Ties — Type III Pre-stressed' },
    { entity_type: 'submittal', action: 'status_changed', description: 'SUB-002 status changed to approved' },
    { entity_type: 'rfi', action: 'created', description: 'Created RFI-001: Utility Conflict at STA 24+50' },
    { entity_type: 'rfi', action: 'status_changed', description: 'RFI-001 answered — field verification complete' },
    { entity_type: 'daily_log', action: 'created', description: 'Daily log submitted for track laying operations' },
    { entity_type: 'punch_list', action: 'created', description: 'Added PL-001: Rail joint gap exceeds tolerance' },
    { entity_type: 'punch_list', action: 'status_changed', description: 'PL-001 status changed to resolved' },
    { entity_type: 'punch_list', action: 'status_changed', description: 'PL-001 verified by inspector' },
    { entity_type: 'milestone', action: 'status_changed', description: 'Mobilization & Site Prep marked complete' },
    { entity_type: 'milestone', action: 'status_changed', description: 'Earthwork & Subgrade marked complete' },
    { entity_type: 'submittal', action: 'created', description: 'Submitted SUB-005: Signal Mast Foundations' },
    { entity_type: 'submittal', action: 'status_changed', description: 'SUB-005 conditionally approved — revise foundation depth at S-4' },
    { entity_type: 'rfi', action: 'created', description: 'Created RFI-006: Turnout Geometry Clarification' },
    { entity_type: 'daily_log', action: 'created', description: 'Daily log — signal conduit trenching, hit rock at 3ft' },
    { entity_type: 'milestone', action: 'status_changed', description: 'Track Construction — Main Line marked complete' },
    { entity_type: 'punch_list', action: 'created', description: 'Added PL-011: Derail device mounting bolts loose' },
    { entity_type: 'submittal', action: 'created', description: 'Submitted SUB-009: Switch Machine — rejected, insufficient throw force' },
    { entity_type: 'rfi', action: 'created', description: 'Created RFI-012: PTC Integration Requirements' },
    { entity_type: 'milestone', action: 'status_changed', description: 'Track Construction — Sidings at risk, 78% complete' },
    { entity_type: 'submittal', action: 'created', description: 'Submitted SUB-015: Switch Heater System (draft)' },
    { entity_type: 'daily_log', action: 'created', description: 'Safety stand-down meeting — fall protection and excavation procedures' },
    { entity_type: 'punch_list', action: 'created', description: 'Added PL-019: Track geometry cross-level out of spec' },
    { entity_type: 'rfi', action: 'status_changed', description: 'RFI-004 answered — Type 2 ballast approved for yard lead' },
    { entity_type: 'project', action: 'updated', description: 'Budget updated: $2.86M spent of $4.2M total (68%)' },
    { entity_type: 'daily_log', action: 'created', description: 'Daily log — final surfacing and alignment, geometry car scheduled' },
    { entity_type: 'submittal', action: 'created', description: 'Submitted SUB-012: Signal Cable — 16AWG Quad' },
    { entity_type: 'punch_list', action: 'status_changed', description: 'PL-003 verified — ballast shoulder width corrected' },
    { entity_type: 'milestone', action: 'updated', description: 'Turnout Installation at 45% — on track' },
    { entity_type: 'rfi', action: 'created', description: 'Created RFI-010: Environmental Buffer Zone — wetland setback' },
    { entity_type: 'daily_log', action: 'created', description: 'Daily log — signal testing on completed circuit 1-4' },
    { entity_type: 'submittal', action: 'status_changed', description: 'SUB-014 conditionally approved — add preheat requirements' },
    { entity_type: 'punch_list', action: 'created', description: 'Added PL-017: Grade crossing flasher alignment off' },
    { entity_type: 'project', action: 'updated', description: 'Schedule update: 30-day extension granted for unforeseen conditions' },
    { entity_type: 'milestone', action: 'updated', description: 'Signal Foundations at 30% — on track' },
  ];

  return entries.map((e, i) => ({
    project_id: projectId,
    entity_type: e.entity_type,
    entity_id: projectId, // simplified — all point to project
    action: e.action,
    description: e.description,
    performed_by: pick(teamIds),
    created_at: daysAgo(120 - i * 3),
  }));
}
