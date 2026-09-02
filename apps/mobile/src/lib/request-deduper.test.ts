import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createRequestDeduper } from './request-deduper';

describe('Mobile request deduplication', () => {
  it('shares an identical in-flight read and permits a later refresh', async () => {
    const deduper = createRequestDeduper();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const operation = async () => { calls += 1; await gate; };
    const first = deduper.run('bootstrap:project-a', operation);
    const duplicate = deduper.run('bootstrap:project-a', operation);
    assert.strictEqual(first, duplicate);
    release();
    await Promise.all([first, duplicate]);
    assert.equal(calls, 1);
    await deduper.run('bootstrap:project-a', operation);
    assert.equal(calls, 2);
  });
});
