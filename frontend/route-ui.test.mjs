import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  clearRouteControls,
  clearRouteDirections,
  bindRoutePreferences,
  readRoutePreferences,
  routeFeedback,
  showRouteDirections
} from './route-ui.mjs';

test('reports route distance and estimated time after a successful search', () => {
  assert.deepEqual(routeFeedback({ distanceMiles: 0.745, estimatedMinutes: 14.7 }, 'Bascom Hill', 'Library Mall'), {
    state: 'success',
    text: 'Route · 0.74 miles · about 15 min'
  });
});

test('reports the accessible path length when accessibility affects route choice', () => {
  assert.deepEqual(routeFeedback({
    distanceMiles: 0.6,
    estimatedMinutes: 12,
    accessibleMiles: 0.75
  }, 'Bascom Hill', 'Library Mall', { accessibility: 80 }), {
    state: 'success',
    text: 'Route · 0.60 miles · about 12 min · accessible path 0.75 miles'
  });
});

test('explains when the selected places have no route', () => {
  assert.deepEqual(routeFeedback(null, 'Bascom Hill', 'Library Mall'), {
    state: 'error',
    text: 'No walking route connects Bascom Hill and Library Mall.'
  });
});

test('explains when no mapped accessible route is available', () => {
  assert.deepEqual(routeFeedback(null, 'Bascom Hill', 'Library Mall', { accessibility: 100 }), {
    state: 'error',
    text: 'No mapped accessible route connects Bascom Hill and Library Mall.'
  });
});

test('clears both endpoint selections', () => {
  const start = { value: 'bascom_hill' };
  const end = { value: 'library_mall' };
  clearRouteControls(start, end);
  assert.equal(start.value, '');
  assert.equal(end.value, '');
});

test('clears route stops and hides their directions section', () => {
  const section = { hidden: false };
  const stops = { cleared: false, replaceChildren() { this.cleared = true; } };

  clearRouteDirections(section, stops);

  assert.equal(stops.cleared, true);
  assert.equal(section.hidden, true);
});

test('shows the directions section after rendering a route', () => {
  const section = { hidden: true };

  showRouteDirections(section);

  assert.equal(section.hidden, false);
});

test('reads slider values as route weights', () => {
  assert.deepEqual(readRoutePreferences({
    distance: { value: '60' },
    time: { value: '30' },
    accessibility: { value: '10' }
  }), { distance: 60, time: 30, accessibility: 10 });
});

test('updates the slider label and recomputes when a preference changes', () => {
  let handleInput;
  let recomputes = 0;
  const input = { value: '40', addEventListener(_name, callback) { handleInput = callback; } };
  const output = { value: '', textContent: '' };

  bindRoutePreferences({ distance: input }, { distance: output }, () => recomputes++);
  handleInput();

  assert.equal(output.value, '40%');
  assert.equal(output.textContent, '40%');
  assert.equal(recomputes, 1);
});

test('renders one labelled range control for each route preference', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  for (const id of ['distance-weight', 'time-weight', 'accessibility-weight']) {
    assert.match(html, new RegExp(`<input id="${id}" type="range"`));
    assert.match(html, new RegExp(`<output id="${id}-value" for="${id}">`));
  }
});
