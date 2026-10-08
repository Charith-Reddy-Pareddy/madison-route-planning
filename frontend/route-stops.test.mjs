import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteStops } from './route-stops.mjs';

const locations = [
  { id: 'a', name: 'Bascom Hill' },
  { id: 'b', name: 'Memorial Union' },
  { id: 'c', name: 'Library Mall' }
];

test('keeps route order and shows cumulative walking distance', () => {
  const roads = [
    { from: 'a', to: 'b', walkMiles: '0.50' },
    { from: 'b', to: 'c', walkMiles: '0.30' },
    { from: 'c', to: 'b', walkMiles: '0.10' }
  ];
  assert.deepEqual(buildRouteStops(['a', 'b', 'c'], locations, roads), [
    { id: 'a', name: 'Bascom Hill', note: 'Start' },
    { id: 'b', name: 'Memorial Union', note: '0.50 miles from start' },
    { id: 'c', name: 'Library Mall', note: 'Destination · 0.80 miles total' }
  ]);
});

test('labels a single-place route as both start and destination', () => {
  assert.deepEqual(buildRouteStops(['a'], locations, []), [
    { id: 'a', name: 'Bascom Hill', note: 'Start and destination' }
  ]);
});

test('rejects a route with a missing directed connection', () => {
  assert.throws(() => buildRouteStops(['a', 'b'], locations, []), /no walking distance/);
});
