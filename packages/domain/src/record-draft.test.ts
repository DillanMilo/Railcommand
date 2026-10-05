import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { MOBILE_SPEC_SECTIONS, validateRecordDraft, type MobileRecordDraft } from './index';
const draft: MobileRecordDraft = { version: 1, kind: 'rfis', projectId: '20000000-0000-4000-8000-000000000001', clientId: '30000000-0000-4000-8000-000000000001', title: 'Question', body: 'Please clarify', priority: 'medium', assignedTo: '10000000-0000-4000-8000-000000000001', dueDate: '2028-02-29', milestoneId: '', specSection: '', updatedAt: '' };
describe('Record creation validation', () => {
  it('requires valid RFI fields, assignee and calendar date', () => {
    assert.equal(validateRecordDraft(draft), null);
    for (const changes of [{ title: ' ' }, { body: '' }, { assignedTo: '' }, { dueDate: '2026-02-29' }, { dueDate: '2026-13-01' }, { projectId: '../' }, { milestoneId: 'bad' }]) assert.ok(validateRecordDraft({ ...draft, ...changes }));
  });
  it('accepts optional submittal description but requires an approved specification section', () => {
    const value = { ...draft, kind: 'submittals' as const, body: '', assignedTo: '', specSection: MOBILE_SPEC_SECTIONS[0] };
    assert.equal(validateRecordDraft(value), null);
    assert.ok(validateRecordDraft({ ...value, specSection: 'invented' }));
  });
});
