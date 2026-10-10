import test from 'node:test';
import assert from 'node:assert/strict';
import { createClosureOverlay } from './closure-overlay.mjs';

test('an empty overlay leaves every road unchanged', () => {
  const overlay = createClosureOverlay();

  assert.equal(overlay.size, 0);
  assert.deepEqual(overlay.list(), []);
  assert.equal(overlay.get('a', 'b'), null);
});

test('stores closed and penalized directed roads', () => {
  const overlay = createClosureOverlay([
    { from: 'a', to: 'b', status: 'closed' },
    { from: 'b', to: 'a', status: 'penalized', multiplier: 1.75 }
  ]);

  assert.deepEqual(overlay.get('a', 'b'), { from: 'a', to: 'b', status: 'closed' });
  assert.deepEqual(overlay.get('b', 'a'), {
    from: 'b', to: 'a', status: 'penalized', multiplier: 1.75
  });
  assert.equal(overlay.get('a', 'c'), null);
  assert.equal(overlay.size, 2);
});

test('normalizes endpoint whitespace and protects stored overrides', () => {
  const overlay = createClosureOverlay([
    { from: ' a ', to: ' b ', status: 'closed' }
  ]);
  const entry = overlay.get('a', 'b');

  assert.equal(entry.from, 'a');
  assert.equal(Object.isFrozen(entry), true);
  assert.equal(Object.isFrozen(overlay), true);
  assert.throws(() => { entry.status = 'penalized'; }, TypeError);
});

test('rejects malformed overlays and duplicate directed roads', () => {
  assert.throws(() => createClosureOverlay({}), /must be a list/);
  assert.throws(() => createClosureOverlay([{ from: '', to: 'b', status: 'closed' }]), /endpoints/);
  assert.throws(() => createClosureOverlay([{ from: 'a', to: 'a', status: 'closed' }]), /endpoints/);
  assert.throws(() => createClosureOverlay([{ from: 'a', to: 'b', status: 'slow' }]), /status/);
  assert.throws(() => createClosureOverlay([
    { from: 'a', to: 'b', status: 'penalized', multiplier: 1 }
  ]), /multiplier greater than 1/);
  assert.throws(() => createClosureOverlay([
    { from: 'a', to: 'b', status: 'closed' },
    { from: 'a', to: 'b', status: 'penalized', multiplier: 2 }
  ]), /more than one/);
});
