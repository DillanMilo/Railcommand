import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import * as domain from '@railcommand/domain';
import type { MobileDailyLog } from '@railcommand/domain';

const projectId = '33333333-3333-4333-8333-333333333333';
const otherProjectId = '44444444-4444-4444-8444-444444444444';
const logId = '55555555-5555-4555-8555-555555555555';
const unavailable = 'Not available in this cached copy. Reconnect and refresh the project.';
const fixture = (): MobileDailyLog => ({
  id: logId, projectId, logDate: '2026-08-30', weatherConditions: 'Clear', workSummary: 'Track alignment completed',
  safetyNotes: 'Safety briefing complete', createdAt: '2026-08-30T12:00:00Z',
  weatherTemp: -12.5, weatherWind: 'NW 8 mph',
  geoTag: { lat: 41.8781134, lng: -87.6297994, accuracy: 4.25, altitude: -6.25, timestamp: '2026-08-30T12:00:00Z' },
  personnel: [{ id: 'personnel-1', role: 'Foreman', headcount: 0, company: 'Synthetic Rail' }],
  equipment: [{ id: 'equipment-1', equipmentType: 'Excavator', count: 0, notes: 'Inspection complete' }],
  workItems: [{ id: 'work-1', description: 'Ballast placed', quantity: 12.75, unit: 'CY', location: 'MP 10.5' }],
});
type Element = { type: unknown; props: Record<string, unknown> };
const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });

// Execute the real TSX and domain normalizer; native/UI/provider boundaries are
// inert. This validates displayed read-only values, not device layout or sync.
function renderLog(logs: MobileDailyLog[], activeProjectId: string | null = projectId, online = false) {
  const compiled = { exports: {} as { default?: () => Element } };
  const { outputText } = ts.transpileModule(readFileSync(new URL('../app/daily-log/[id].tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const components = Object.fromEntries(['BrandHeader', 'Card', 'EmptyState', 'PageHeading', 'Screen', 'SecondaryButton', 'SectionTitle', 'StatusBanner', 'StatusPill'].map((name) => [name, name]));
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports, Error, console,
    require(name: string) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === 'react-native') return { Text: 'Text', View: 'View', StyleSheet: { create: (value: unknown) => value } };
      if (name === 'expo-router') return { useLocalSearchParams: () => ({ id: logId }), router: { back() {} } };
      if (name === '@railcommand/domain') return domain;
      if (name === '@/components/ui') return { ...components, uiStyles: {} };
      if (name === '@/lib/device') return { shareDailyLogSummary: () => { throw new Error('Rendering must not share or change data'); } };
      if (name === '@/providers/mobile-data-provider') return { useMobileData: () => ({ activeProjectId, online,
        bootstrap: { dailyLogs: logs, projects: [{ id: projectId, name: 'Project P' }, { id: otherProjectId, name: 'Project Q' }] } }) };
      if (name === '@/theme') return { colors: {}, fonts: {} };
      throw new Error(`Unexpected daily-log readback dependency: ${name}`);
    },
  });
  const text: string[] = [];
  const nodes: Element[] = [];
  function visit(value: unknown): void {
    if (typeof value === 'string' || typeof value === 'number') { text.push(String(value)); return; }
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object' || !('props' in value)) return;
    const element = value as Element;
    if (typeof element.type === 'function') { visit(element.type(element.props)); return; }
    nodes.push(element);
    for (const key of ['title', 'detail', 'label', 'badge']) if (typeof element.props[key] === 'string') text.push(element.props[key] as string);
    visit(element.props.children);
  }
  visit(compiled.exports.default!());
  return { text: text.join(' '), nodes };
}

describe('Read-only rich daily-log detail rendering', () => {
  it('renders synchronized weather, GPS, personnel, equipment and work values while offline', () => {
    const { text, nodes } = renderLog([fixture()]);
    for (const expected of ['READ ONLY', 'Viewing saved device data', 'Clear', '-12.5', 'NW 8 mph',
      'GPS location', '41.878113', '-87.629799', '4.25', '-6.25', 'Foreman', 'Synthetic Rail',
      'Excavator', 'Inspection complete', 'Ballast placed', '12.75', 'CY', 'MP 10.5',
      'Track alignment completed', 'Safety briefing complete']) assert.ok(text.includes(expected), expected);
    assert.doesNotMatch(text, /Not available in this cached copy/);
    assert.match(text, /Accuracy:\s*4\.25\s*m/);
    assert.match(text, /Altitude:\s*-6\.25\s*m/);
    assert.equal(nodes.some((node) => node.type === 'TextInput' || 'onChangeText' in node.props), false);
    assert.equal(nodes.some((node) => node.type === 'SecondaryButton' && /^(?:Save|Submit|Edit log)\b/i.test(String(node.props.title ?? ''))), false);
  });

  it('displays real zeros instead of substituting missing-data labels', () => {
    const log = fixture(); log.weatherTemp = 0;
    log.geoTag = { lat: 0, lng: 0, accuracy: 0, altitude: 0, timestamp: '2026-08-30T12:00:00Z' };
    log.workItems![0].quantity = 0;
    const { text } = renderLog([log], projectId, true);
    assert.match(text, /0(?:\s*°|\s*F)/);
    assert.ok(text.includes('0.000000'));
    assert.match(text, /Headcount:\s*0/);
    assert.match(text, /Count:\s*0/);
    assert.match(text, /Quantity:\s*0/);
    assert.match(text, /Accuracy:\s*0\s*m/);
    assert.match(text, /Altitude:\s*0\s*m/);
    assert.doesNotMatch(text, /Not available in this cached copy|No personnel recorded|No equipment recorded|No work items recorded/);
  });

  it('labels missing legacy cache fields as unavailable without claiming known-empty sections', () => {
    const legacy = fixture();
    delete legacy.weatherTemp; delete legacy.weatherWind; delete legacy.geoTag;
    delete legacy.personnel; delete legacy.equipment; delete legacy.workItems;
    for (const online of [false, true]) {
      const { text } = renderLog([legacy], projectId, online);
      assert.ok(text.includes(unavailable));
      assert.doesNotMatch(text, /No personnel recorded\.|No equipment recorded\.|No work items recorded\./);
      assert.ok(text.includes('Track alignment completed'));
      assert.ok(text.includes('Safety briefing complete'));
    }
  });

  it('distinguishes known empty sections and explicit absent weather/GPS from unavailable old data', () => {
    const log = { ...fixture(), weatherTemp: null, weatherWind: '', geoTag: null, personnel: [], equipment: [], workItems: [] };
    const { text } = renderLog([log]);
    for (const expected of ['No personnel recorded.', 'No equipment recorded.', 'No work items recorded.', 'GPS location']) assert.ok(text.includes(expected), expected);
    assert.ok(!text.includes(unavailable));
    assert.doesNotMatch(text, /NaN|Infinity|undefined|null/);
  });

  it('handles malformed optional cached values without crashing or rendering unsafe raw data', () => {
    const malformed = { ...fixture(), weatherTemp: NaN, weatherWind: { privateSecret: 'DO-NOT-RENDER' },
      geoTag: { lat: 1000, lng: -87, timestamp: 'not-a-date' }, personnel: 'DO-NOT-RENDER',
      equipment: [{ id: 'bad', equipmentType: {}, count: Infinity, notes: 'DO-NOT-RENDER' }], workItems: null } as unknown as MobileDailyLog;
    const { text } = renderLog([malformed]);
    assert.ok(text.includes(unavailable));
    assert.doesNotMatch(text, /DO-NOT-RENDER|NaN|Infinity|\[object Object\]/);
    assert.ok(text.includes('Track alignment completed'));
  });

  it('never displays another project’s rich fields even when its log ID matches', () => {
    const foreign = { ...fixture(), projectId: otherProjectId, workSummary: 'OTHER-PROJECT-SECRET', weatherWind: 'OTHER-PROJECT-WIND' };
    const { text } = renderLog([foreign, fixture()]);
    assert.doesNotMatch(text, /OTHER-PROJECT/);
    assert.ok(text.includes('Track alignment completed'));
    const missing = renderLog([fixture()], otherProjectId);
    assert.match(missing.text, /Record unavailable/);
    assert.doesNotMatch(missing.text, /Track alignment completed|41\.878113|Synthetic Rail/);
    const noProject = renderLog([fixture()], null);
    assert.match(noProject.text, /Record unavailable/);
    assert.doesNotMatch(noProject.text, /Track alignment completed|41\.878113|Synthetic Rail/);
  });
});
import { URL } from 'node:url';
