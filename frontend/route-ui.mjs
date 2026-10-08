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
