import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';

type Element = { type: unknown; props: Record<string, any> };
function nodes(value: any): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !value.props) return [];
  return [value, ...nodes(value.props.children)];
}
describe('Native same-day calendar navigation', () => {
  it('opens every log for the selected date rather than picking one arbitrary record', () => {
    const date = new Date();
    const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const logs = [
      { id: 'first', projectId: 'project', logDate: day, workSummary: 'First crew work', createdAt: date.toISOString(), authorName: 'Crew One' },
      { id: 'second', projectId: 'project', logDate: day, workSummary: 'Second crew work', createdAt: date.toISOString(), authorName: 'Crew Two' },
      { id: 'other', projectId: 'project', logDate: '2025-01-01', workSummary: 'Other day work', createdAt: date.toISOString() },
    ];
    const states: any[] = []; let cursor = 0; const navigation: string[] = [];
    const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
    const deps: Record<string, any> = {
      'react': { useMemo: (fn: () => unknown) => fn(), useState: (initial: any) => {
        const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
      } },
      'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
      'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: (s: unknown) => s } },
      'expo-router': { router: { push: (path: string) => navigation.push(path) } },
      'expo-symbols': { SymbolView: 'SymbolView' },
      '@/components/ui': { Screen: 'Screen', StatusBanner: 'StatusBanner' },
      '@/components/web-shell': { RailBotButton: 'RailBotButton', WebHeader: 'WebHeader' },
      '@/lib/project-routes': { recordsForProject: (rows: typeof logs, project: string) => rows.filter(row => row.projectId === project) },
      '@/providers/mobile-data-provider': { useMobileData: () => ({ activeProjectId: 'project', online: true, bootstrap: { projects: [{ id: 'project', name: 'Synthetic', canEdit: true }], dailyLogs: logs } }) },
      '@/theme': { colors: {}, fonts: {} },
    };
    const compiled = { exports: {} as { default: () => Element } };
    runInNewContext(ts.transpileModule(readFileSync(new URL('../app/(tabs)/logs.tsx', import.meta.url), 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText, { module: compiled, exports: compiled.exports, require: (name: string) => { if (!(name in deps)) throw new Error(name); return deps[name]; } });
    const render = () => { cursor=0; return nodes(compiled.exports.default()); };
    const calendar = render();
    const cell = calendar.find(node => node.props.accessibilityLabel?.endsWith(', 2 daily logs'));
    assert.ok(cell); cell.props.onPress();
    const list = render(); const text = list.filter(node => node.type === 'Text').map(node => node.props.children).flat().join(' ');
    assert.match(text, /First crew work/); assert.match(text, /Second crew work/); assert.doesNotMatch(text, /Other day work/);
    const logRows = list.filter(node => node.type === 'Pressable' && nodes(node).some(child => child.props.children === 'First crew work' || child.props.children === 'Second crew work'));
    assert.equal(logRows.length, 2); logRows.forEach(row => row.props.onPress());
    assert.deepEqual(navigation, ['/daily-log/first', '/daily-log/second']);
  });
});
