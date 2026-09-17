import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { navigateWorkspace, workspaceNavigationPath } from '../workspace-navigation';

describe('native commands reuse web client navigation safely', () => {
  it('allows internal destinations but rejects external/auth/traversal inputs', () => {
    assert.equal(workspaceNavigationPath('/projects/a/photos'), '/projects/a/photos');
    assert.equal(workspaceNavigationPath('/search?q=test'), '/search?q=test');
    for (const value of [null, {}, '/login', '/auth/mobile-session', '//evil.test', 'javascript:alert(1)', '/projects/../auth', '/projects/%2e%2e/auth', '/projects/\\evil', '/dashboard#hash']) assert.equal(workspaceNavigationPath(value), null);
  });
  it('does not navigate or discard dirty input offline or when leaving is cancelled', () => {
    const paths: string[] = [];
    const options = { online: false, dirty: true, confirm: () => { throw new Error('Must not prompt while offline'); }, push: (path: string) => paths.push(path) };
    assert.equal(navigateWorkspace('/projects/a/photos', options), false);
    assert.equal(navigateWorkspace('/projects/a/photos', { ...options, online: true, confirm: () => false }), false);
    assert.deepEqual(paths, []);
    assert.equal(navigateWorkspace('/projects/a/photos', { ...options, online: true, confirm: () => true }), true);
    assert.deepEqual(paths, ['/projects/a/photos']);
  });
  it('routes clean pages without a confirmation or new authentication request', () => {
    const paths: string[] = [];
    assert.equal(navigateWorkspace('/dashboard', { online: true, dirty: false, confirm: () => { throw new Error('Unexpected prompt'); }, push: (path) => paths.push(path) }), true);
    assert.deepEqual(paths, ['/dashboard']);
  });
});
