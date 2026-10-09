/** Build readable stop labels and cumulative distances for a walking route. */
export function buildRouteStops(locationIds, locations, roads, distanceField = 'walkMiles') {
  if (locationIds.length === 0) {
    throw new Error('A route must contain at least one location.');
  }

  const places = new Map(locations.map(location => [location.id, location]));
  const lastIndex = locationIds.length - 1;
  let milesFromStart = 0;
  return locationIds.map((id, index) => {
    const place = places.get(id);
    if (!place) throw new Error(`Route contains an unknown location: ${id}.`);

    if (index > 0) {
      const fromId = locationIds[index - 1];
      const distances = roads
        .filter(road => road.from === fromId && road.to === id)
        .map(road => Number(road[distanceField]))
        .filter(miles => Number.isFinite(miles) && miles >= 0);
      if (distances.length === 0) {
        throw new Error(`Route has no walking distance from '${fromId}' to '${id}'.`);
      }
      milesFromStart += Math.min(...distances);
    }

    let note;
    if (lastIndex === 0) {
      note = 'Start and destination';
    } else if (index === 0) {
      note = 'Start';
    } else if (index === lastIndex) {
      note = `Destination · ${milesFromStart.toFixed(2)} miles total`;
    } else {
      note = `${milesFromStart.toFixed(2)} miles from start`;
    }
    return { id, name: place.name, note };
  });
}
