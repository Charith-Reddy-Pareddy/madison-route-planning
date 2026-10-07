/** Find the shortest walking route through the directed road list. */
export function shortestWalk(locations, roads, startId, endId) {
  const ids = new Set(locations.map(location => location.id));
  if (!ids.has(startId) || !ids.has(endId)) {
    throw new Error('Choose a known start and destination.');
  }

  const nextRoads = new Map([...ids].map(id => [id, []]));
  for (const road of roads) {
    const rawMiles = String(road.walkMiles ?? '').trim();
    const miles = rawMiles ? Number(rawMiles) : NaN;
    if (!ids.has(road.from) || !ids.has(road.to)
        || !Number.isFinite(miles) || miles < 0) {
      throw new Error('The road data contains an invalid walking connection.');
    }
    nextRoads.get(road.from).push({ id: road.to, miles });
  }

  const distance = new Map([...ids].map(id => [id, Infinity]));
  const previous = new Map();
  const remaining = new Set(ids);
  distance.set(startId, 0);

  while (remaining.size > 0) {
    let current = null;
    for (const id of remaining) {
      if (current === null || distance.get(id) < distance.get(current)) {
        current = id;
      }
    }
    if (current === null || !Number.isFinite(distance.get(current))) break;
    if (current === endId) break;
    remaining.delete(current);

    for (const road of nextRoads.get(current)) {
      if (!remaining.has(road.id)) continue;
      const candidate = distance.get(current) + road.miles;
      if (candidate < distance.get(road.id)) {
        distance.set(road.id, candidate);
        previous.set(road.id, current);
      }
    }
  }

  if (!Number.isFinite(distance.get(endId))) return null;
  const locationIds = [endId];
  while (locationIds[0] !== startId) {
    const parent = previous.get(locationIds[0]);
    if (parent === undefined) return null;
    locationIds.unshift(parent);
  }
  return { locationIds, distanceMiles: distance.get(endId) };
}
