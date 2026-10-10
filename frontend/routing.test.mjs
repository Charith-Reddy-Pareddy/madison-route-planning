import test from 'node:test';
import assert from 'node:assert/strict';
import { createClosureOverlay } from './closure-overlay.mjs';
import { shortestWalk, weightedWalk } from './routing.mjs';

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

test('distance-only weights match the plain shortest walk', () => {
  const roads = [
    { from: 'a', to: 'b', walkMiles: 0.6, accessibleMiles: 0.8 },
    { from: 'a', to: 'c', walkMiles: 0.3, accessibleMiles: 0.3 },
    { from: 'c', to: 'b', walkMiles: 0.4, accessibleMiles: 0.4 }
  ];
  const plain = shortestWalk(places, roads, 'a', 'b');
  const weighted = weightedWalk(places, roads, 'a', 'b', {
    distance: 100, time: 0, accessibility: 0
  });

  assert.deepEqual(weighted.locationIds, plain.locationIds);
  assert.equal(weighted.distanceMiles, plain.distanceMiles);
});

test('accessibility weights choose the shorter mapped accessible route', () => {
  const roads = [
    { from: 'a', to: 'b', walkMiles: 0.5, accessibleMiles: 1.2 },
    { from: 'a', to: 'c', walkMiles: 0.25, accessibleMiles: 0.25 },
    { from: 'c', to: 'b', walkMiles: 0.35, accessibleMiles: 0.35 }
  ];
  const distanceRoute = weightedWalk(places, roads, 'a', 'b', {
    distance: 100, time: 0, accessibility: 0
  });
  const accessibleRoute = weightedWalk(places, roads, 'a', 'b', {
    distance: 0, time: 0, accessibility: 100
  });

  assert.deepEqual(distanceRoute.locationIds, ['a', 'b']);
  assert.deepEqual(accessibleRoute.locationIds, ['a', 'c', 'b']);
  assert.equal(accessibleRoute.accessibleMiles, 0.6);
});

test('a weight sweep changes the selected path', () => {
  const roads = [
    { from: 'a', to: 'b', walkMiles: 0.5, accessibleMiles: 2 },
    { from: 'a', to: 'c', walkMiles: 0.35, accessibleMiles: 0.35 },
    { from: 'c', to: 'b', walkMiles: 0.35, accessibleMiles: 0.35 }
  ];
  const paths = [0, 10, 50, 100].map(accessibility => weightedWalk(places, roads, 'a', 'b', {
    distance: 100 - accessibility,
    time: 0,
    accessibility
  }).locationIds.join(','));

  assert.ok(paths.includes('a,b'));
  assert.ok(paths.includes('a,c,b'));
});

test('time weights can favor a longer route without stairs', () => {
  const timedPlaces = [
    ...places,
    { id: 'x' }, { id: 'y' }, { id: 'z' }, { id: 'q' }
  ];
  const roads = [
    { from: 'a', to: 'b', walkMiles: 0.6, hasSteps: false },
    { from: 'a', to: 'x', walkMiles: 0.1, hasSteps: true },
    { from: 'x', to: 'y', walkMiles: 0.1, hasSteps: true },
    { from: 'y', to: 'z', walkMiles: 0.1, hasSteps: true },
    { from: 'z', to: 'q', walkMiles: 0.1, hasSteps: true },
    { from: 'q', to: 'b', walkMiles: 0.1, hasSteps: true }
  ];
  const distanceRoute = weightedWalk(timedPlaces, roads, 'a', 'b', {
    distance: 100, time: 0, accessibility: 0
  });
  const fasterRoute = weightedWalk(timedPlaces, roads, 'a', 'b', {
    distance: 0, time: 100, accessibility: 0
  });

  assert.deepEqual(distanceRoute.locationIds, ['a', 'x', 'y', 'z', 'q', 'b']);
  assert.deepEqual(fasterRoute.locationIds, ['a', 'b']);
  assert.ok(fasterRoute.distanceMiles > distanceRoute.distanceMiles);
  assert.ok(fasterRoute.estimatedMinutes < distanceRoute.estimatedMinutes);
});

test('strict accessibility excludes roads without mapped accessible mileage', () => {
  assert.equal(weightedWalk(places, [
    { from: 'a', to: 'b', walkMiles: 0.2, accessibleMiles: '' }
  ], 'a', 'b', { distance: 0, time: 0, accessibility: 100 }), null);
});

test('rejects weights outside the slider range', () => {
  assert.throws(() => weightedWalk(places, [], 'a', 'b', {
    distance: 101, time: 0, accessibility: 0
  }), /between 0 and 100/);
});

test('all-zero preferences fall back to the shortest walk', () => {
  const result = weightedWalk(places, [
    { from: 'a', to: 'b', walkMiles: 0.8 },
    { from: 'a', to: 'c', walkMiles: 0.2 },
    { from: 'c', to: 'b', walkMiles: 0.2 }
  ], 'a', 'b', { distance: 0, time: 0, accessibility: 0 });

  assert.deepEqual(result.locationIds, ['a', 'c', 'b']);
  assert.equal(result.distanceMiles, 0.4);
});

test('closed roads are excluded without changing the base road data', () => {
  const roads = [
    { from: 'a', to: 'b', walkMiles: 0.3 },
    { from: 'a', to: 'c', walkMiles: 0.25 },
    { from: 'c', to: 'b', walkMiles: 0.25 },
    { from: 'b', to: 'a', walkMiles: 0.4 }
  ];
  const originalRoads = structuredClone(roads);
  const closures = createClosureOverlay([{ from: 'a', to: 'b', status: 'closed' }]);

  assert.deepEqual(shortestWalk(places, roads, 'a', 'b', closures).locationIds, ['a', 'c', 'b']);
  assert.deepEqual(shortestWalk(places, roads, 'b', 'a', closures).locationIds, ['b', 'a']);
  assert.deepEqual(roads, originalRoads);
});

test('penalized roads can make route search choose another connection', () => {
  const roads = [
    { from: 'a', to: 'b', walkMiles: 0.3 },
    { from: 'a', to: 'c', walkMiles: 0.25 },
    { from: 'c', to: 'b', walkMiles: 0.25 }
  ];
  const penalty = createClosureOverlay([
    { from: 'a', to: 'b', status: 'penalized', multiplier: 3 }
  ]);

  assert.deepEqual(weightedWalk(places, roads, 'a', 'b').locationIds, ['a', 'b']);
  assert.deepEqual(weightedWalk(places, roads, 'a', 'b', {}, penalty).locationIds, ['a', 'c', 'b']);
});

test('a closed final connection returns no route', () => {
  const roads = [{ from: 'a', to: 'b', walkMiles: 0.3 }];
  const closures = createClosureOverlay([{ from: 'a', to: 'b', status: 'closed' }]);

  assert.equal(weightedWalk(places, roads, 'a', 'b', {}, closures), null);
});

test('rejects closure overrides for roads absent from the static graph', () => {
  const closures = createClosureOverlay([{ from: 'a', to: 'b', status: 'closed' }]);

  assert.throws(() => weightedWalk(places, [], 'a', 'b', {}, closures), /unknown road/);
});
