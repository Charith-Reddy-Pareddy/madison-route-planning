import { createClosureOverlay } from './closure-overlay.mjs';

const emptyClosureOverlay = createClosureOverlay();

/** Find the shortest walking route through the directed road list. */
export function shortestWalk(
    locations, roads, startId, endId, closureOverlay = emptyClosureOverlay) {
  const route = findRoute(locations, roads, startId, endId, {
    distance: 1,
    time: 0,
    accessibility: 0
  }, false, closureOverlay);
  if (!route) return null;
  return { locationIds: route.locationIds, distanceMiles: route.distanceMiles };
}

const NO_ACCESSIBLE_PATH_PENALTY_MILES = 2;
const MINUTES_PER_MILE = 20;
const STEP_DELAY_MINUTES = 0.5;

/** Find a route using normalized distance, time, and accessibility preferences. */
export function weightedWalk(
    locations, roads, startId, endId, weights = {}, closureOverlay = emptyClosureOverlay) {
  const rawWeights = {
    distance: Number(weights.distance ?? 100),
    time: Number(weights.time ?? 0),
    accessibility: Number(weights.accessibility ?? 0)
  };
  for (const value of Object.values(rawWeights)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error('Route preferences must be between 0 and 100.');
    }
  }

  const totalWeight = Object.values(rawWeights).reduce((sum, value) => sum + value, 0);
  const normalized = totalWeight === 0
    ? { distance: 1, time: 0, accessibility: 0 }
    : Object.fromEntries(Object.entries(rawWeights).map(([key, value]) => [key, value / totalWeight]));
  return findRoute(locations, roads, startId, endId, normalized,
    rawWeights.accessibility === 100, closureOverlay);
}

function findRoute(locations, roads, startId, endId, weights, requireAccessible, closureOverlay) {
  const ids = new Set(locations.map(location => location.id));
  if (!ids.has(startId) || !ids.has(endId)) {
    throw new Error('Choose a known start and destination.');
  }
  if (!closureOverlay || typeof closureOverlay.get !== 'function'
      || typeof closureOverlay.list !== 'function') {
    throw new Error('A route needs a valid closure overlay.');
  }

  const nextRoads = new Map([...ids].map(id => [id, []]));
  const roadKeys = new Set();
  for (const road of roads) {
    const rawMiles = String(road.walkMiles ?? '').trim();
    const miles = rawMiles ? Number(rawMiles) : NaN;
    const rawAccessibleMiles = String(road.accessibleMiles ?? '').trim();
    const accessibleMiles = rawAccessibleMiles ? Number(rawAccessibleMiles) : null;
    const rawIncline = String(road.maxInclinePercent ?? '0').trim();
    const incline = rawIncline ? Number(rawIncline) : NaN;
    if (!ids.has(road.from) || !ids.has(road.to)
        || !Number.isFinite(miles) || miles < 0
        || (accessibleMiles !== null
          && (!Number.isFinite(accessibleMiles) || accessibleMiles < 0))
        || !Number.isFinite(incline) || incline < 0) {
      throw new Error('The road data contains an invalid walking connection.');
    }
    roadKeys.add(`${road.from}\u0000${road.to}`);
    const override = closureOverlay.get(road.from, road.to);
    if (override?.status === 'closed') continue;
    if (override && (override.status !== 'penalized'
        || !Number.isFinite(override.multiplier) || override.multiplier <= 1)) {
      throw new Error('The closure overlay contains an invalid road adjustment.');
    }
    const hasSteps = road.hasSteps === true || String(road.hasSteps).trim().toLowerCase() === 'true';
    if (requireAccessible && accessibleMiles === null) continue;

    const timeMinutes = miles * MINUTES_PER_MILE + (hasSteps ? STEP_DELAY_MINUTES : 0);
    const accessMiles = accessibleMiles ?? miles + NO_ACCESSIBLE_PATH_PENALTY_MILES;
    let cost = weights.distance * miles
      + weights.time * timeMinutes / MINUTES_PER_MILE
      + weights.accessibility * accessMiles;
    if (override?.status === 'penalized') cost *= override.multiplier;
    nextRoads.get(road.from).push({
      id: road.to,
      miles,
      timeMinutes,
      accessibleMiles,
      cost
    });
  }
  for (const override of closureOverlay.list()) {
    if (!roadKeys.has(`${override.from}\u0000${override.to}`)) {
      throw new Error(`Closure overlay refers to an unknown road: ${override.from} to ${override.to}.`);
    }
  }

  const costs = new Map([...ids].map(id => [id, Infinity]));
  const previous = new Map();
  const remaining = new Set(ids);
  costs.set(startId, 0);

  while (remaining.size > 0) {
    let current = null;
    for (const id of remaining) {
      if (current === null || costs.get(id) < costs.get(current)) {
        current = id;
      }
    }
    if (current === null || !Number.isFinite(costs.get(current))) break;
    if (current === endId) break;
    remaining.delete(current);

    for (const road of nextRoads.get(current)) {
      if (!remaining.has(road.id)) continue;
      const candidate = costs.get(current) + road.cost;
      if (candidate < costs.get(road.id)) {
        costs.set(road.id, candidate);
        previous.set(road.id, { id: current, road: { ...road, from: current } });
      }
    }
  }

  if (!Number.isFinite(costs.get(endId))) return null;
  const locationIds = [endId];
  const roadSegments = [];
  while (locationIds[0] !== startId) {
    const step = previous.get(locationIds[0]);
    if (step === undefined) return null;
    locationIds.unshift(step.id);
    roadSegments.unshift(step.road);
  }

  const distanceMiles = roadSegments.reduce((sum, road) => sum + road.miles, 0);
  const estimatedMinutes = roadSegments.reduce((sum, road) => sum + road.timeMinutes, 0);
  const accessibleRouteKnown = roadSegments.every(road => road.accessibleMiles !== null);
  const accessibleMiles = accessibleRouteKnown
    ? roadSegments.reduce((sum, road) => sum + road.accessibleMiles, 0)
    : null;
  return {
    locationIds,
    distanceMiles,
    estimatedMinutes,
    accessibleMiles,
    roadSegments: roadSegments.map(({ from, id, miles, accessibleMiles: access }) => ({
      from,
      to: id,
      walkMiles: miles,
      accessibleMiles: access
    })),
    objectiveCost: costs.get(endId)
  };
}
