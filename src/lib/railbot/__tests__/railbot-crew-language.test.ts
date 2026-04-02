/**
 * RailBot Crew Language Integration Tests
 *
 * Validates that the tool executor handles create operations correctly
 * with the kind of structured data the AI would produce after parsing
 * informal field crew language. Also tests team member lookup for
 * assignee resolution.
 */

import { executeDemoTool } from '../tool-executor';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`         ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

function assert(condition: boolean, message?: string) {
  if (!condition) throw new Error(message ?? 'Assertion failed');
}

async function main() {
  console.log('\n--- 1. RFI Creation Flows ---');

  await test('Create RFI with full crew-parsed fields', async () => {
    const result = await executeDemoTool('create_rfi', {
      subject: 'Broken signal box at Mile Post 42',
      question: 'Signal box at MP 42 is damaged and non-functional. Requesting guidance on replacement procedure and timeline.',
      priority: 'high',
      assigned_to: 'prof-003',
      due_date: '2026-04-07',
    }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Should succeed');
    const data = result.data as Record<string, unknown>;
    assert((data.number as string).startsWith('RFI-'), 'Should have RFI number');
    assert(data.status === 'open', 'Should default to open');
    assert(data.priority === 'high', 'Priority should be high');
  });

  await test('Create RFI with minimal fields (defaults applied)', async () => {
    const result = await executeDemoTool('create_rfi', {
      subject: 'Ballast type inquiry',
      question: 'Need clarification on approved ballast types for yard lead section.',
    }, 'superintendent', 'proj-001', 'prof-002');
    assert(result.success === true, 'Should succeed');
    const data = result.data as Record<string, unknown>;
    assert(data.priority === 'medium', 'Should default to medium priority');
    assert((data.number as string).startsWith('RFI-'), 'Should have RFI number');
  });

  await test('Contractor can create RFI', async () => {
    const result = await executeDemoTool('create_rfi', {
      subject: 'Material spec clarification',
      question: 'Need spec confirmation for Type II cement used in base pours.',
    }, 'contractor', 'proj-001', 'prof-006');
    assert(result.success === true, 'Should succeed for contractor');
  });

  await test('Inspector can create RFI', async () => {
    const result = await executeDemoTool('create_rfi', {
      subject: 'Grade verification at station 12+50',
      question: 'Grade measurements at station 12+50 appear off by 0.5 inches. Requesting re-survey.',
    }, 'inspector', 'proj-001', 'prof-009');
    assert(result.success === true, 'Should succeed for inspector');
  });

  console.log('\n--- 2. Punch List Creation Flows ---');

  await test('Create punch list with full crew-parsed fields', async () => {
    const result = await executeDemoTool('create_punch_list_item', {
      title: 'Cracked rail tie on east siding',
      description: 'Rail tie is cracked and needs replacement on the east siding near Switch 3.',
      location: 'East Siding - Switch 3',
      priority: 'high',
      assigned_to: 'prof-003',
      due_date: '2026-04-07',
    }, 'foreman', 'proj-001', 'prof-004');
    assert(result.success === true, 'Should succeed');
    const data = result.data as Record<string, unknown>;
    assert((data.number as string).startsWith('PL-'), 'Should have PL number');
    assert(data.priority === 'high', 'Priority should be high');
  });

  await test('Create punch list with minimal fields', async () => {
    const result = await executeDemoTool('create_punch_list_item', {
      title: 'Missing reflectors on Switch 7',
      description: 'Reflectors are missing on Switch 7, safety hazard.',
      location: 'Switch 7',
    }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Should succeed');
    const data = result.data as Record<string, unknown>;
    assert(data.priority === 'medium', 'Should default to medium');
    assert(data.status === 'open', 'Should default to open');
  });

  await test('Create critical punch item', async () => {
    const result = await executeDemoTool('create_punch_list_item', {
      title: 'Rail gap exceeds tolerance at MP 15',
      description: 'Rail gap measured at 1.5 inches, exceeds 0.75 inch tolerance. Immediate attention required.',
      location: 'Mile Post 15 - Main Line',
      priority: 'critical',
    }, 'superintendent', 'proj-001', 'prof-002');
    assert(result.success === true, 'Should succeed');
    const data = result.data as Record<string, unknown>;
    assert(data.priority === 'critical', 'Priority should be critical');
  });

  await test('Owner CANNOT create punch list items', async () => {
    const result = await executeDemoTool('create_punch_list_item', {
      title: 'Test',
      description: 'Test',
      location: 'Test',
    }, 'owner', 'proj-001', 'prof-009');
    assert(result.success === false, 'Should be denied');
    assert(result.error!.includes('Permission denied'), 'Should say permission denied');
  });

  console.log('\n--- 3. Daily Log Creation Flows ---');

  await test('Create daily log from crew speech', async () => {
    const result = await executeDemoTool('create_daily_log', {
      log_date: '2026-03-31',
      weather_temp: 45,
      weather_conditions: 'Cloudy',
      weather_wind: '10-15 mph NW',
      work_summary: 'Laid 200 ft of rail on the main line. Completed ballast tamping on east siding.',
      safety_notes: 'No incidents. All PPE compliance verified.',
    }, 'foreman', 'proj-001', 'prof-004');
    assert(result.success === true, 'Should succeed');
    const data = result.data as Record<string, unknown>;
    assert((data.work_summary as string).includes('200 ft'), 'Should preserve work details');
    assert(data.weather_temp === 45, 'Should preserve temperature');
  });

  await test('Create daily log with minimal fields', async () => {
    const result = await executeDemoTool('create_daily_log', {
      work_summary: 'Continued grading work on yard lead. Stopped at 2pm due to rain.',
    }, 'contractor', 'proj-001', 'prof-006');
    assert(result.success === true, 'Should succeed with just work summary');
  });

  await test('Inspector CANNOT create daily logs', async () => {
    const result = await executeDemoTool('create_daily_log', {
      work_summary: 'Test log',
    }, 'inspector', 'proj-001', 'prof-009');
    assert(result.success === false, 'Should be denied');
    assert(result.error!.includes('Permission denied'), 'Should say permission denied');
  });

  await test('Owner CANNOT create daily logs', async () => {
    const result = await executeDemoTool('create_daily_log', {
      work_summary: 'Test log',
    }, 'owner', 'proj-001', 'prof-009');
    assert(result.success === false, 'Should be denied');
  });

  console.log('\n--- 4. Team Member Lookup (Assignee Resolution) ---');

  await test('Find Bobby by first name', async () => {
    const result = await executeDemoTool('get_team_members', { search: 'Bobby' }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Should succeed');
    const members = result.data as { name: string }[];
    assert(members.length > 0, 'Should find Bobby');
    assert(members.some((m) => m.name.includes('Bobby')), 'Should match Bobby Hernandez');
  });

  await test('Find by last name', async () => {
    const result = await executeDemoTool('get_team_members', { search: 'Morrison' }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Should succeed');
    const members = result.data as { name: string }[];
    assert(members.some((m) => m.name.includes('Morrison')), 'Should find Patricia Morrison');
  });

  await test('Find by role filter', async () => {
    const result = await executeDemoTool('get_team_members', { role: 'engineer' }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Should succeed');
    const members = result.data as { project_role: string }[];
    assert(members.length > 0, 'Should find engineers');
    assert(members.every((m) => m.project_role === 'engineer'), 'All should be engineers');
  });

  await test('No match returns empty', async () => {
    const result = await executeDemoTool('get_team_members', { search: 'Nonexistent' }, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Should succeed');
    const members = result.data as unknown[];
    assert(members.length === 0, 'Should find no one');
  });

  await test('List all team members', async () => {
    const result = await executeDemoTool('get_team_members', {}, 'manager', 'proj-001', 'prof-001');
    assert(result.success === true, 'Should succeed');
    const members = result.data as unknown[];
    assert(members.length > 0, 'Should return team members');
  });

  console.log('\n========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');
  if (failed > 0) process.exit(1);
}

main();
