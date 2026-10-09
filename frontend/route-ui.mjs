/** Build a short status message for a route result. */
export function routeFeedback(route, startName, endName, weights = {}) {
  if (!route) {
    if (Number(weights.accessibility) === 100) {
      return {
        state: 'error',
        text: `No mapped accessible route connects ${startName} and ${endName}.`
      };
    }
    return {
      state: 'error',
      text: `No walking route connects ${startName} and ${endName}.`
    };
  }
  const time = Number.isFinite(route.estimatedMinutes)
    ? ` · about ${Math.round(route.estimatedMinutes)} min`
    : '';
  const access = Number(weights.accessibility) > 0
    ? route.accessibleMiles === null
      ? ' · some links have no mapped accessible route'
      : ` · accessible path ${route.accessibleMiles.toFixed(2)} miles`
    : '';
  return {
    state: 'success',
    text: `Route · ${route.distanceMiles.toFixed(2)} miles${time}${access}`
  };
}

/** Reset the route endpoint selects. */
export function clearRouteControls(start, end) {
  start.value = '';
  end.value = '';
}

/** Clear the route stops and hide their directions section. */
export function clearRouteDirections(section, stops) {
  stops.replaceChildren();
  section.hidden = true;
}

/** Show the directions section after its route stops have been rendered. */
export function showRouteDirections(section) {
  section.hidden = false;
}

/** Read slider values as route weights. */
export function readRoutePreferences(inputs) {
  return Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, Number(input.value)]));
}

/** Keep slider values visible and recompute the selected route as they change. */
export function bindRoutePreferences(inputs, values, onChange) {
  for (const [key, input] of Object.entries(inputs)) {
    input.addEventListener('input', () => {
      const value = `${input.value}%`;
      values[key].value = value;
      values[key].textContent = value;
      onChange();
    });
  }
}
