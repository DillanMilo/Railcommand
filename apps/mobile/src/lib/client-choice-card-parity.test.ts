import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('Client choice and daily-log card parity', () => {
  it('measures safe-area insets inside the native modal rather than the underlying screen', () => {
    const choice = source('../components/form-choice.tsx');
    assert.ok(choice.indexOf('<Modal ') < choice.indexOf('<SafeAreaProvider>'));
    assert.match(choice, /<SafeAreaProvider>\s*<SafeAreaView style=\{styles\.sheet\}>/);
    assert.match(choice, /<\/SafeAreaView>\s*<\/SafeAreaProvider>\s*<\/Modal>/);
  });

  it('distinguishes a search miss from unavailable choices without assuming connectivity is the cause', () => {
    const choice = source('../components/form-choice.tsx');
    assert.match(choice, /const emptyMessage = choices\.length > 0\s*\? 'No matching choices\. Clear your search to see all options\.'\s*: 'No choices are available for this field\.'/);
    assert.match(choice, /ListEmptyComponent=\{<Text style=\{styles\.text\}>\{emptyMessage\}<\/Text>\}/);
    assert.doesNotMatch(choice, /Reconnect to refresh project choices/);
  });

  it('keeps existing optional choices, saved selections, and user-driven selection changes', () => {
    const choice = source('../components/form-choice.tsx');
    assert.match(choice, /optional \? \[\{ id: '', name: 'None' \}, \.\.\.options\] : options/);
    assert.match(choice, /options\.find\(\(item\) => item\.id === value\)/);
    assert.match(choice, /choices\.filter\(\(item\) => item\.name\.toLowerCase\(\)\.includes\(search\.trim\(\)\.toLowerCase\(\)\)\)/);
    assert.match(choice, /onPress=\{\(\) => \{ onChange\(item\.id\); setOpen\(false\); \}\}/);
  });

  it('reuses the native command-card radius and offset shadow without clipping or extra card padding', () => {
    const fields = source('../components/daily-log-fields.tsx');
    const nativeCard = source('../components/ui.tsx');
    assert.match(fields, /import \{ Field, uiStyles \} from '\.\/ui'/);
    assert.match(fields, /card: \{ \.\.\.uiStyles\.card, padding: 0, gap: 0 \}/);
    assert.match(nativeCard, /borderRadius: radii\.command/);
    assert.match(nativeCard, /shadowOpacity: 0\.045/);
    assert.match(nativeCard, /shadowOffset: \{ width: 3, height: 3 \}/);
    assert.match(fields, /content: \{ padding: 16, gap: 16 \}/);
  });
});
