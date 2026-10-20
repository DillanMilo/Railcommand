import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { availableIOSUpdate, supportsIOSAppUpdates, type InstalledMobileApp } from './app-release';

const installed: InstalledMobileApp = { platform: 'ios', profile: 'production', applicationId: 'io.railcommand.app', buildNumber: '300013' };
const release = { schemaVersion: 1, ios: { buildNumber: 300014, version: '1.0.0', channel: 'testflight' } };
describe('published native app release comparison', () => {
  it('offers only a strictly newer native build, including same marketing version', () => {
    assert.deepEqual(availableIOSUpdate(installed, release), release.ios);
    assert.equal(availableIOSUpdate({ ...installed, buildNumber: '300014' }, release), null);
    assert.equal(availableIOSUpdate({ ...installed, buildNumber: '300015' }, release), null);
  });
  it('never routes web, Android, staging or another bundle to iPhone TestFlight', () => {
    for (const patch of [{ platform: 'android' }, { platform: 'web' }, { profile: 'staging' }, { profile: 'development' }, { applicationId: 'io.railcommand.app.staging' }, { applicationId: null }]) {
      assert.equal(supportsIOSAppUpdates({ ...installed, ...patch }), false);
      assert.equal(availableIOSUpdate({ ...installed, ...patch }, release), null);
    }
  });
  it('ignores unknown or malformed installed/released versions', () => {
    for (const buildNumber of [null, '', '0', '-1', '300013.0', '3e5', '9007199254740992']) assert.equal(availableIOSUpdate({ ...installed, buildNumber }, release), null);
    for (const value of [null, {}, { ...release, schemaVersion: 2 }, { ...release, ios: null }, ...['300014', -1, NaN, Infinity, 300014.5].map(buildNumber => ({ ...release, ios: { ...release.ios, buildNumber } })), { ...release, ios: { ...release.ios, channel: 'unknown' } }, { ...release, ios: { ...release.ios, version: '<script>' } }]) assert.equal(availableIOSUpdate(installed, value), null);
  });
});
