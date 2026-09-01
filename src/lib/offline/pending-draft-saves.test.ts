import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';
import { flushPendingDraftSaves, registerPendingDraftSave } from './pending-draft-saves';

describe('pending draft sign-out protection', () => {
  it('waits for the mounted form save before allowing stored-work inspection', async () => {
    let finishSave!: () => void;
    let inspected = false;
    const unregister = registerPendingDraftSave('synthetic-user-a', () => new Promise<void>((resolve) => {
      finishSave = resolve;
    }));
    try {
      const flushed = flushPendingDraftSaves('synthetic-user-a').then(() => { inspected = true; });
      await Promise.resolve();
      assert.equal(inspected, false);
      finishSave();
      await flushed;
      assert.equal(inspected, true);
    } finally {
      unregister();
    }
  });

  it('fails closed when any active draft cannot be persisted', async () => {
    const failure = new DOMException('Synthetic quota failure', 'QuotaExceededError');
    const unregister = registerPendingDraftSave('synthetic-user-a', async () => { throw failure; });
    try {
      await assert.rejects(flushPendingDraftSaves('synthetic-user-a'), (error) => error === failure);
    } finally {
      unregister();
    }
  });

  it('flushes only the requested user and unregisters forms on unmount', async () => {
    let aSaves = 0;
    let bSaves = 0;
    const unregisterA = registerPendingDraftSave('synthetic-user-a', async () => { aSaves++; });
    const unregisterB = registerPendingDraftSave('synthetic-user-b', async () => { bSaves++; });
    try {
      await flushPendingDraftSaves('synthetic-user-a');
      assert.equal(aSaves, 1);
      assert.equal(bSaves, 0);
      unregisterA();
      await flushPendingDraftSaves('synthetic-user-a');
      assert.equal(aSaves, 1);
    } finally {
      unregisterA();
      unregisterB();
    }
  });

  it('wires strict form persistence ahead of both non-discard sign-out inspections', () => {
    const hook = readFileSync(new URL('../../hooks/useDailyLogDraft.ts', import.meta.url), 'utf8');
    const provider = readFileSync(new URL('../../components/providers/OfflineSyncProvider.tsx', import.meta.url), 'utf8');
    assert.match(hook, /registerPendingDraftSave\(offlineUserId, \(\) => persistLatest\(true\)\)/);
    assert.match(hook, /if \(requireSaved\) throw error/);
    const request = provider.slice(provider.indexOf('const requestSignOut'), provider.indexOf('const synchronizeAndSignOut'));
    const synchronized = provider.slice(provider.indexOf('const synchronizeAndSignOut'), provider.indexOf('const discardAndSignOut'));
    assert.ok(request.indexOf('await flushPendingDraftSaves(activeUserId)') < request.indexOf('const [queued, drafts]'));
    assert.ok(synchronized.indexOf('await flushPendingDraftSaves(activeUserId)') < synchronized.indexOf('const [remaining, drafts]'));
  });

  it('blocks queueing before draft hydration so an unread draft cannot be deleted', () => {
    const hook = readFileSync(new URL('../../hooks/useDailyLogDraft.ts', import.meta.url), 'utf8');
    const queue = hook.slice(hook.indexOf('const queueDraft ='), hook.indexOf('  return {'));
    const guard = queue.indexOf('if (!hydratedRef.current) throw new Error(');
    assert.ok(guard >= 0, 'Queueing must reject an unverified saved draft');
    assert.ok(guard < queue.indexOf('await enqueueDailyLogCreate('));
  });
});
