import assert from 'node:assert/strict';
import { ACTIONS, canPerform } from './permissions';

describe('photo deletion permissions', () => {
  it('allows project managers to delete project photos', () => {
    assert.equal(canPerform('manager', ACTIONS.PHOTO_DELETE), true);
  });

  it('does not grant elevated photo deletion to ordinary project roles', () => {
    for (const role of [
      'superintendent',
      'foreman',
      'engineer',
      'contractor',
      'inspector',
      'owner',
    ] as const) {
      assert.equal(canPerform(role, ACTIONS.PHOTO_DELETE), false, role);
    }
  });
});
