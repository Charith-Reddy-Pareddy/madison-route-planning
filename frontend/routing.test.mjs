import test from 'node:test';
import assert from 'node:assert/strict';
import { shortestWalk } from './routing.mjs';

const places = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('chooses the least-distance path', () => {
  const roads = [
    { from: 'a', to: 'b', walkMiles: '1.5' },
    { from: 'a', to: 'c', walkMiles: '0.4' },
    { from: 'c', to: 'b', walkMiles: '0.6' }
  ];
  assert.deepEqual(shortestWalk(places, roads, 'a', 'b'), {
    locationIds: ['a', 'c', 'b'], distanceMiles: 1
  });
});

test('respects one-way roads', () => {
  const roads = [{ from: 'a', to: 'b', walkMiles: '0.2' }];
  assert.equal(shortestWalk(places, roads, 'b', 'a'), null);
});

test('returns no route for disconnected places', () => {
  assert.equal(shortestWalk(places, [], 'a', 'c'), null);
});

test('returns a zero-distance route when start and destination match', () => {
  assert.deepEqual(shortestWalk(places, [], 'a', 'a'), {
    locationIds: ['a'], distanceMiles: 0
  });
});

test('rejects blank or negative walking distances', () => {
  assert.throws(() => shortestWalk(places, [
    { from: 'a', to: 'b', walkMiles: '' }
  ], 'a', 'b'), /invalid walking connection/);
  assert.throws(() => shortestWalk(places, [
    { from: 'a', to: 'b', walkMiles: '-0.1' }
  ], 'a', 'b'), /invalid walking connection/);
});
