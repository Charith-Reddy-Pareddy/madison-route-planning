import { createClosureOverlay } from './closure-overlay.mjs';
import { weightedWalk } from './routing.mjs';

/** Bind a static road network to its active closure overlay. */
export function createRoutePlanner(locations, roads, closureOverlay = createClosureOverlay()) {
  let activeOverlay = closureOverlay;

  function validateOverlay(overlay) {
    if (!overlay || typeof overlay.get !== 'function' || typeof overlay.list !== 'function') {
      throw new Error('A route needs a valid closure overlay.');
    }
    for (const override of overlay.list()) {
      if (!roads.some(road => road.from === override.from && road.to === override.to)) {
        throw new Error(`Closure overlay refers to an unknown road: ${override.from} to ${override.to}.`);
      }
    }
  }

  validateOverlay(activeOverlay);

  return Object.freeze({
    findRoute(startId, endId, weights = {}) {
      return weightedWalk(locations, roads, startId, endId, weights, activeOverlay);
    },
    setClosures(overrides) {
      const nextOverlay = createClosureOverlay(overrides);
      validateOverlay(nextOverlay);
      activeOverlay = nextOverlay;
    }
  });
}
