import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createBotStreamParser, newBotDraft, parseBotDraft, serializeBotDraft } from './railbot';
describe('RailBot mobile transport and retained drafts', () => {
  it('parses responses split across every byte including unicode, proposals and completion', () => {
    const chunks: unknown[] = [];
    const parse = createBotStreamParser(c => chunks.push(c));
    const events = [{ type: 'text', content: 'Field crew ✓' }, { type: 'proposal', proposal: { id: 'one' } }, { type: 'done' }];
    const bytes = new TextEncoder().encode(events.map(e => `data: ${JSON.stringify(e)}\r\n\r\n`).join(''));
    const decoder = new TextDecoder();
    for (const byte of bytes) parse(decoder.decode(new Uint8Array([byte]), { stream: true }));
    parse(decoder.decode()); assert.deepEqual(chunks, events);
  });
  it('never manufactures completion for a truncated response', () => {
    const chunks: unknown[] = []; const parse = createBotStreamParser(c => chunks.push(c));
    parse('data: {"type":"text","content":"partial"}\n\ndata: {"type":"do');
    assert.deepEqual(chunks, [{ type: 'text', content: 'partial' }]);
  });
  it('retains input, uncertain delivery and recording reference across restart', () => {
    const draft = { ...newBotDraft('projectA'), input: 'Unsent field question', uncertain: true, audioUri: 'file:///private/recording.m4a' };
    assert.deepEqual(parseBotDraft(serializeBotDraft(draft), 'projectA'), draft);
    assert.throws(() => parseBotDraft(serializeBotDraft(draft), 'projectB'));
  });
  it('rejects unreadable or oversized drafts without returning an empty replacement', () => {
    assert.throws(() => parseBotDraft('broken', 'project'));
    assert.throws(() => serializeBotDraft({ ...newBotDraft('project'), input: 'x'.repeat(600_000) }));
  });
});
