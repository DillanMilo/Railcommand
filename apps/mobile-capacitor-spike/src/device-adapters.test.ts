import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { captureCurrentLocation, haptic, shareProjectLink } from './device-adapters';

describe('mobile device adapters', () => {
  it('keeps a draft usable when location permission is denied', async () => {
    let positionRequested = false;
    const result = await captureCurrentLocation({
      checkPermissions: async () => ({ location: 'prompt', coarseLocation: 'prompt' }),
      requestPermissions: async () => ({ location: 'denied', coarseLocation: 'denied' }),
      getCurrentPosition: async () => {
        positionRequested = true;
        throw new Error('must not run');
      },
    });
    assert.equal(result.status, 'denied');
    assert.equal(positionRequested, false);
    assert.match(result.message, /draft remains usable/i);
  });

  it('normalizes an allowed device position for the shared draft contract', async () => {
    const result = await captureCurrentLocation({
      checkPermissions: async () => ({ location: 'granted', coarseLocation: 'granted' }),
      requestPermissions: async () => ({ location: 'granted', coarseLocation: 'granted' }),
      getCurrentPosition: async () => ({
        timestamp: Date.parse('2026-08-24T12:00:00.000Z'),
        coords: {
          latitude: 41.88,
          longitude: -87.63,
          accuracy: 8,
          altitude: null,
          altitudeAccuracy: null,
          speed: null,
          heading: null,
          magneticHeading: null,
          trueHeading: null,
          headingAccuracy: null,
          course: null,
        },
      }),
    });
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.value.lat, 41.88);
      assert.equal(result.value.accuracy, 8);
      assert.equal(result.value.timestamp, '2026-08-24T12:00:00.000Z');
    }
  });

  it('returns a clear fallback when the share sheet is unavailable', async () => {
    const result = await shareProjectLink('project-1', 'Test project', {
      canShare: async () => ({ value: false }),
      share: async () => { throw new Error('must not run'); },
    });
    assert.equal(result.status, 'unavailable');
  });

  it('never lets unsupported haptics block a field workflow', async () => {
    await assert.doesNotReject(() => haptic('success', {
      impact: async () => { throw new Error('unsupported'); },
      notification: async () => { throw new Error('unsupported'); },
    }));
  });
});
