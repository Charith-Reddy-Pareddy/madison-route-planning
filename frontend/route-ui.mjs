/** Build a short status message for a route result. */
export function routeFeedback(route, startName, endName) {
  if (!route) {
    return {
      state: 'error',
      text: `No walking route connects ${startName} and ${endName}.`
    };
  }
  return { state: 'success', text: `Shortest walk · ${route.distanceMiles.toFixed(2)} miles` };
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
