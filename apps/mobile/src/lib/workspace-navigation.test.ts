import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { StackRouter, StackActions } from 'expo-router/build/react-navigation/routers/StackRouter';

describe('retained Workspace navigation', () => {
  const options = { routeNames: ['workspace', '(tabs)', 'more'], routeParamList: {}, routeGetIdList: {} };
  it('keeps the existing screen key and replaces only destination params after More', () => {
    const router = StackRouter({ initialRouteName: 'workspace' });
    let state = router.getInitialState(options);
    const key = state.routes[0].key;
    state = router.getRehydratedState(router.getStateForAction(state, StackActions.push('(tabs)'), options)!, options);
    state = router.getRehydratedState(router.getStateForAction(state, StackActions.push('more'), options)!, options);
    state = router.getRehydratedState(router.getStateForAction(state, StackActions.popTo('workspace', { path: '/projects/a/photos', request: '1' }), options)!, options);
    assert.equal(state.routes.length, 1);
    assert.equal(state.routes[0].key, key);
    assert.deepEqual(state.routes[0].params, { path: '/projects/a/photos', request: '1' });
    state = router.getRehydratedState(router.getStateForAction(state, StackActions.popTo('workspace', { path: '/projects/a/photos', request: '2' }), options)!, options);
    assert.equal(state.routes[0].key, key);
    assert.deepEqual(state.routes[0].params, { path: '/projects/a/photos', request: '2' });
  });
  it('creates a workspace when none exists instead of failing navigation', () => {
    const router = StackRouter({ initialRouteName: '(tabs)' });
    let state = router.getInitialState(options);
    state = router.getRehydratedState(router.getStateForAction(state, StackActions.push('more'), options)!, options);
    state = router.getRehydratedState(router.getStateForAction(state, StackActions.popTo('workspace', { path: '/dashboard', request: '1' }), options)!, options);
    assert.deepEqual(state.routes.map((route) => route.name), ['(tabs)', 'workspace']);
  });
});
