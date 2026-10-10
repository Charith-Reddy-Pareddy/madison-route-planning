import { createClosureOverlay } from './closure-overlay.mjs';
import { weightedWalk } from './routing.mjs';

/** Bind a static road network to its active closure overlay. */
export function createRoutePlanner(locations, roads, closureOverlay = createClosureOverlay()) {
  return Object.freeze({
    findRoute(startId, endId, weights = {}) {
      return weightedWalk(locations, roads, startId, endId, weights, closureOverlay);
    }
  });
}
