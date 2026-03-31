/**
 * RailBot RBAC & Query Handling Tests
 *
 * Run with: npx tsx src/lib/railbot/__tests__/railbot-rbac.test.ts
 *
 * Uses the demo-mode tool executor (no Supabase needed) and real seed data
 * to validate permission gating, data scoping, search filters, budget RBAC,
 * write tool output, and system prompt generation.
 */

import { executeDemoTool } from '../tool-executor';
import { buildSystemPrompt } from '../system-prompt';
import { getAllowedActions } from '../../permissions';
import {
  seedSubmittals,
  seedRFIs,
  seedDailyLogs,
  seedPunchListItems,
  seedMilestones,
  seedProject,
} from '../../seed-data';

// ── Test harness ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  FAIL  ${name} -- ${msg}`);
  }
}

async function main() {
  // ============================================================================
  // 1. Permission Gating Tests
  // ============================================================================
  console.log('\n--- 1. Permission Gating ---');

  await test('Inspector CANNOT create daily logs', async () => {
    const result = await executeDemoTool('create_daily_log', { work_summary: 'test' }, 'inspector', 'proj-001', 'prof-009');
    assert(result.success === false, 'Expected success=false');
    assert(typeof result.error === 'string' && result.error.includes('Permission denied'), 'Expected Permission denied error');
  });

  await test('Foreman CANNOT view budget', async () => {
    const result = await executeDemoTool('get_budget_summary', {}, 'foreman', 'proj-001', 'prof-004');
    assert(result.success === false, 'Expected success=false');
    assert(typeof result.error === 'string' && result.error.includes('Permission denied'), 'Expected Permission denied error');
  });

  await test('Contractor CAN use read tools (no perm required)', async () => {
    const result = await executeDemoTool('search_submittals', {}, 'contractor', 'proj-001', 'prof-006');
    assert(result.success === true, 'Expected success=true for read tool');
  });

  await test('Contractor CAN create punch list items', async () => {
    const result = await executeDemoTool('create_punch_list_item', {
      title: 'Test', description: 'Test', location: 'Test',
    }, 'contractor', 'proj-001', 'prof-006');
    assert(result.success === true, 'Contractor should be able to create punch list items');
  });

  await test('Manager CAN create daily log', async () => {
    const result = await executeDemoTool('create_daily_log', { work_summary: 'Manager log' }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Manager should be able to create daily logs');
  });

  await test('Manager CAN create RFI', async () => {
    const result = await executeDemoTool('create_rfi', { subject: 'Test', question: 'Test?' }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Manager should be able to create RFIs');
  });

  await test('Manager CAN view budget', async () => {
    const result = await executeDemoTool('get_budget_summary', {}, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Manager should be able to view budget');
  });

  await test('Owner CAN view budget', async () => {
    const result = await executeDemoTool('get_budget_summary', {}, 'owner', 'proj-001', 'prof-009');
    assert(result.success === true, 'Owner should be able to view budget');
  });

  await test('Owner CAN create RFIs', async () => {
    const result = await executeDemoTool('create_rfi', { subject: 'Owner RFI', question: 'Q?' }, 'owner', 'proj-001', 'prof-009');
    assert(result.success === true, 'Owner should be able to create RFIs');
  });

  await test('Owner CANNOT create daily logs', async () => {
    const result = await executeDemoTool('create_daily_log', { work_summary: 'test' }, 'owner', 'proj-001', 'prof-009');
    assert(result.success === false, 'Owner should NOT be able to create daily logs');
    assert(typeof result.error === 'string' && result.error.includes('Permission denied'), 'Expected Permission denied');
  });

  await test('Owner CANNOT create punch list items', async () => {
    const result = await executeDemoTool('create_punch_list_item', {
      title: 'Test', description: 'Test', location: 'Test',
    }, 'owner', 'proj-001', 'prof-009');
    assert(result.success === false, 'Owner should NOT be able to create punch list items');
    assert(typeof result.error === 'string' && result.error.includes('Permission denied'), 'Expected Permission denied');
  });

  // ============================================================================
  // 2. Data Scoping Tests
  // ============================================================================
  console.log('\n--- 2. Data Scoping ---');

  await test('search_submittals only returns data for proj-001', async () => {
    const result = await executeDemoTool('search_submittals', {}, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as Array<{ id: string }>;
    assert(data.length > 0, 'Expected at least one submittal');
    const seedIds = seedSubmittals.filter(s => s.project_id === 'proj-001').map(s => s.id);
    for (const item of data) {
      assert(seedIds.includes(item.id), `Submittal ${item.id} is not from proj-001`);
    }
  });

  await test('get_project_summary counts match seed data for proj-001', async () => {
    const result = await executeDemoTool('get_project_summary', {}, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as {
      totalSubmittals: number; totalRFIs: number;
      totalPunchList: number; totalMilestones: number;
    };
    const expectedSubs = seedSubmittals.filter(s => s.project_id === 'proj-001').length;
    const expectedRFIs = seedRFIs.filter(r => r.project_id === 'proj-001').length;
    const expectedPunch = seedPunchListItems.filter(p => p.project_id === 'proj-001').length;
    const expectedMs = seedMilestones.filter(m => m.project_id === 'proj-001').length;

    assert(data.totalSubmittals === expectedSubs, `Submittals: expected ${expectedSubs}, got ${data.totalSubmittals}`);
    assert(data.totalRFIs === expectedRFIs, `RFIs: expected ${expectedRFIs}, got ${data.totalRFIs}`);
    assert(data.totalPunchList === expectedPunch, `Punch list: expected ${expectedPunch}, got ${data.totalPunchList}`);
    assert(data.totalMilestones === expectedMs, `Milestones: expected ${expectedMs}, got ${data.totalMilestones}`);
  });

  await test('search for non-existent project returns empty', async () => {
    const result = await executeDemoTool('search_submittals', {}, 'manager', 'proj-999', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as Array<unknown>;
    assert(data.length === 0, `Expected 0 results for proj-999, got ${data.length}`);
  });

  // ============================================================================
  // 3. Search/Filter Tests
  // ============================================================================
  console.log('\n--- 3. Search/Filter ---');

  await test('search_submittals with status=approved', async () => {
    const result = await executeDemoTool('search_submittals', { status: 'approved' }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as Array<{ status: string }>;
    assert(data.length > 0, 'Expected at least one approved submittal');
    for (const item of data) {
      assert(item.status === 'approved', `Expected status=approved, got ${item.status}`);
    }
    const expectedCount = seedSubmittals.filter(s => s.project_id === 'proj-001' && s.status === 'approved').length;
    assert(data.length === expectedCount, `Expected ${expectedCount} approved submittals, got ${data.length}`);
  });

  await test('search_rfis with priority=critical', async () => {
    const result = await executeDemoTool('search_rfis', { priority: 'critical' }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as Array<{ priority: string }>;
    for (const item of data) {
      assert(item.priority === 'critical', `Expected priority=critical, got ${item.priority}`);
    }
    const expectedCount = seedRFIs.filter(r => r.project_id === 'proj-001' && r.priority === 'critical').length;
    assert(data.length === expectedCount, `Expected ${expectedCount} critical RFIs, got ${data.length}`);
  });

  await test('get_overdue_items returns items with due_date before today', async () => {
    const result = await executeDemoTool('get_overdue_items', {}, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as {
      overdueSubmittals: Array<{ due_date: string }>;
      overdueRFIs: Array<{ due_date: string }>;
      overduePunchList: Array<{ due_date: string }>;
    };
    const today = new Date().toISOString().split('T')[0];
    const allOverdue = [
      ...data.overdueSubmittals,
      ...data.overdueRFIs,
      ...data.overduePunchList,
    ];
    for (const item of allOverdue) {
      assert(item.due_date < today, `Item due_date ${item.due_date} should be before today ${today}`);
    }
  });

  await test('search_daily_logs with date range filter', async () => {
    const result = await executeDemoTool('search_daily_logs', {
      date_from: '2026-01-01',
      date_to: '2026-01-31',
    }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as Array<{ log_date: string }>;
    for (const item of data) {
      assert(item.log_date >= '2026-01-01', `log_date ${item.log_date} should be >= 2026-01-01`);
      assert(item.log_date <= '2026-01-31', `log_date ${item.log_date} should be <= 2026-01-31`);
    }
  });

  await test('search_submittals with text search filter', async () => {
    const result = await executeDemoTool('search_submittals', { search: 'signal' }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as Array<{ title: string; spec_section: string }>;
    assert(data.length > 0, 'Expected at least one result for "signal"');
    for (const item of data) {
      const matchesTitle = item.title.toLowerCase().includes('signal');
      const matchesSpec = item.spec_section.toLowerCase().includes('signal');
      assert(matchesTitle || matchesSpec, `Item "${item.title}" / "${item.spec_section}" should match "signal"`);
    }
  });

  await test('search_rfis with status=open', async () => {
    const result = await executeDemoTool('search_rfis', { status: 'open' }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as Array<{ status: string }>;
    for (const item of data) {
      assert(item.status === 'open', `Expected status=open, got ${item.status}`);
    }
  });

  // ============================================================================
  // 4. Budget RBAC Tests
  // ============================================================================
  console.log('\n--- 4. Budget RBAC ---');

  await test('Manager CAN get budget summary with valid amounts', async () => {
    const result = await executeDemoTool('get_budget_summary', {}, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as { budgetTotal: number; budgetSpent: number; budgetRemaining: number };
    assert(data.budgetTotal === seedProject.budget_total,
      `budgetTotal: expected ${seedProject.budget_total}, got ${data.budgetTotal}`);
    assert(data.budgetSpent === seedProject.budget_spent,
      `budgetSpent: expected ${seedProject.budget_spent}, got ${data.budgetSpent}`);
    assert(data.budgetRemaining === seedProject.budget_total - seedProject.budget_spent,
      `budgetRemaining mismatch`);
    assert(data.budgetTotal > 0, 'budgetTotal should be > 0');
  });

  await test('Foreman CANNOT get budget summary', async () => {
    const result = await executeDemoTool('get_budget_summary', {}, 'foreman', 'proj-001', 'prof-004');
    assert(result.success === false, 'Expected success=false');
    assert(typeof result.error === 'string' && result.error.includes('Permission denied'), 'Expected Permission denied');
  });

  await test('Owner CAN get budget summary', async () => {
    const result = await executeDemoTool('get_budget_summary', {}, 'owner', 'proj-001', 'prof-009');
    assert(result.success === true, 'Expected success');
    const data = result.data as { budgetTotal: number };
    assert(data.budgetTotal > 0, 'budgetTotal should be > 0');
  });

  await test('Superintendent CAN get budget summary', async () => {
    const result = await executeDemoTool('get_budget_summary', {}, 'superintendent', 'proj-001', 'prof-004');
    assert(result.success === true, 'Expected success');
  });

  await test('Engineer CAN get budget summary', async () => {
    const result = await executeDemoTool('get_budget_summary', {}, 'engineer', 'proj-001', 'prof-005');
    assert(result.success === true, 'Expected success');
  });

  await test('Contractor CANNOT get budget summary', async () => {
    const result = await executeDemoTool('get_budget_summary', {}, 'contractor', 'proj-001', 'prof-006');
    assert(result.success === false, 'Expected success=false');
    assert(typeof result.error === 'string' && result.error.includes('Permission denied'), 'Expected Permission denied');
  });

  await test('Inspector CANNOT get budget summary', async () => {
    const result = await executeDemoTool('get_budget_summary', {}, 'inspector', 'proj-001', 'prof-009');
    assert(result.success === false, 'Expected success=false');
    assert(typeof result.error === 'string' && result.error.includes('Permission denied'), 'Expected Permission denied');
  });

  // ============================================================================
  // 5. Write Tool Confirmation Tests
  // ============================================================================
  console.log('\n--- 5. Write Tool Output ---');

  await test('create_rfi returns properly numbered RFI', async () => {
    const result = await executeDemoTool('create_rfi', {
      subject: 'Test RFI', question: 'Is this working?',
    }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as { number: string; status: string; subject: string };
    assert(data.number.startsWith('RFI-'), `Expected RFI- prefix, got ${data.number}`);
    assert(data.status === 'open', `Expected status=open, got ${data.status}`);
    assert(data.subject === 'Test RFI', `Expected subject "Test RFI", got "${data.subject}"`);
  });

  await test('create_punch_list_item returns properly numbered item', async () => {
    const result = await executeDemoTool('create_punch_list_item', {
      title: 'Test PL', description: 'Test description', location: 'Test location',
    }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as { number: string; status: string; title: string };
    assert(data.number.startsWith('PL-'), `Expected PL- prefix, got ${data.number}`);
    assert(data.status === 'open', `Expected status=open, got ${data.status}`);
    assert(data.title === 'Test PL', `Expected title "Test PL", got "${data.title}"`);
  });

  await test('create_daily_log returns log with correct data', async () => {
    const result = await executeDemoTool('create_daily_log', {
      work_summary: 'Ballast placement on siding 3',
      weather_temp: 42,
      weather_conditions: 'Cloudy',
    }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Expected success');
    const data = result.data as { work_summary: string; weather_temp: number; weather_conditions: string };
    assert(data.work_summary === 'Ballast placement on siding 3', 'work_summary mismatch');
    assert(data.weather_temp === 42, `weather_temp: expected 42, got ${data.weather_temp}`);
    assert(data.weather_conditions === 'Cloudy', 'weather_conditions mismatch');
  });

  await test('Unknown tool returns error', async () => {
    const result = await executeDemoTool('nonexistent_tool', {}, 'manager', 'proj-001', 'prof-001');
    assert(result.success === false, 'Expected success=false');
    assert(typeof result.error === 'string' && result.error.includes('Unknown tool'), 'Expected Unknown tool error');
  });

  // ============================================================================
  // 6. System Prompt RBAC Tests
  // ============================================================================
  console.log('\n--- 6. System Prompt RBAC ---');

  await test('Manager prompt includes budget:view and CAN view budget', () => {
    const prompt = buildSystemPrompt({
      profile: {
        id: 'prof-001', full_name: 'Mark Sullivan', email: 'mark.sullivan@a5rail.com',
        phone: '(303) 555-0101', role: 'admin', organization_id: 'org-001', avatar_url: '', created_at: '2025-01-15T00:00:00Z',
      },
      membership: {
        id: 'pm-001', project_id: 'proj-001', profile_id: 'prof-001',
        project_role: 'manager', can_edit: true, added_at: '2025-07-15T00:00:00Z',
      },
      permissions: getAllowedActions('manager'),
      projectId: 'proj-001',
    });
    assert(prompt.includes('budget:view'), 'Manager prompt should include budget:view');
    assert(prompt.includes('This user CAN view budget data'), 'Manager prompt should say CAN view budget');
  });

  await test('Foreman prompt restricts budget and says CANNOT', () => {
    const prompt = buildSystemPrompt({
      profile: {
        id: 'prof-003', full_name: 'Bobby Hernandez', email: 'bobby.hernandez@mwtrack.com',
        phone: '(720) 555-0201', role: 'member', organization_id: 'org-002', avatar_url: '', created_at: '2025-02-01T00:00:00Z',
      },
      membership: {
        id: 'pm-003', project_id: 'proj-001', profile_id: 'prof-003',
        project_role: 'foreman', can_edit: true, added_at: '2025-08-01T00:00:00Z',
      },
      permissions: getAllowedActions('foreman'),
      projectId: 'proj-001',
    });
    assert(prompt.includes('CANNOT view budget data'), 'Foreman prompt should say CANNOT view budget data');
    const allowedSection = prompt.split('The user CAN perform the following actions:')[1]?.split('The user CANNOT perform:')[0] ?? '';
    assert(!allowedSection.includes('budget:view'), 'Foreman allowed section should NOT include budget:view');
  });

  await test('Inspector prompt lists only 3 allowed actions', () => {
    const perms = getAllowedActions('inspector');
    assert(perms.length === 3, `Inspector should have 3 permissions, got ${perms.length}`);
    assert(perms.includes('punch_list:create'), 'Inspector should have punch_list:create');
    assert(perms.includes('punch_list:verify'), 'Inspector should have punch_list:verify');
    assert(perms.includes('rfi:create'), 'Inspector should have rfi:create');
  });

  await test('Owner prompt includes budget:view but not daily_log:create', () => {
    const perms = getAllowedActions('owner');
    assert(perms.includes('budget:view'), 'Owner should have budget:view');
    assert(perms.includes('rfi:create'), 'Owner should have rfi:create');
    assert(!perms.includes('daily_log:create'), 'Owner should NOT have daily_log:create');
    assert(!perms.includes('punch_list:create'), 'Owner should NOT have punch_list:create');
  });

  await test('System prompt includes user name and project role', () => {
    const prompt = buildSystemPrompt({
      profile: {
        id: 'prof-006', full_name: 'Derek Washington', email: 'derek.washington@frsignal.com',
        phone: '(303) 555-0301', role: 'member', organization_id: 'org-003', avatar_url: '', created_at: '2025-02-01T00:00:00Z',
      },
      membership: {
        id: 'pm-006', project_id: 'proj-001', profile_id: 'prof-006',
        project_role: 'contractor', can_edit: true, added_at: '2025-08-15T00:00:00Z',
      },
      permissions: getAllowedActions('contractor'),
      projectId: 'proj-001',
    });
    assert(prompt.includes('Derek Washington'), 'Prompt should include user name');
    assert(prompt.includes('contractor'), 'Prompt should include project role');
  });

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('\n========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
    process.exit(1);
  }

  console.log('\nAll tests passed.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
