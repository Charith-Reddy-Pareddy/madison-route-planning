import { parseCsv } from './csv.mjs';
import { shortestWalk } from './routing.mjs';
import { buildRouteStops } from './route-stops.mjs';
import { clearRouteControls, routeFeedback } from './route-ui.mjs';

const roadLayer = document.querySelector('#road-layer');
const routeLayer = document.querySelector('#route-layer');
const locationLayer = document.querySelector('#location-layer');
const status = document.querySelector('#map-status');
const result = document.querySelector('#route-result');
const routeStops = document.querySelector('#route-stops');
const routeDirections = document.querySelector('#route-directions');
const routeForm = document.querySelector('#route-form');
const startSelect = document.querySelector('#route-start');
const endSelect = document.querySelector('#route-end');
const submitButton = document.querySelector('#route-submit');
const clearButton = document.querySelector('#route-clear');
const svgNamespace = 'http://www.w3.org/2000/svg';
const width = 1000;
const height = 560;
const padding = 42;
let points = new Map();
let markerById = new Map();
let roads = [];

function element(name, attributes = {}) {
  const node = document.createElementNS(svgNamespace, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    node.setAttribute(attribute, value);
  }
  return node;
}

function projectLocations(locations) {
  const averageLatitude = locations.reduce((sum, location) => sum + location.lat, 0)
      / locations.length;
  const longitudeScale = Math.cos(averageLatitude * Math.PI / 180);
  const projected = locations.map(location => ({
    ...location,
    projectedX: location.lon * longitudeScale,
    projectedY: location.lat
  }));
  const minX = Math.min(...projected.map(point => point.projectedX));
  const maxX = Math.max(...projected.map(point => point.projectedX));
  const minY = Math.min(...projected.map(point => point.projectedY));
  const maxY = Math.max(...projected.map(point => point.projectedY));
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  return new Map(projected.map(point => [point.id, {
    ...point,
    x: offsetX + (point.projectedX - minX) * scale,
    y: height - offsetY - (point.projectedY - minY) * scale
  }]));
}

function addLocationOptions(locations) {
  const ordered = [...locations].sort((a, b) => a.name.localeCompare(b.name));
  for (const location of ordered) {
    for (const select of [startSelect, endSelect]) {
      const option = document.createElement('option');
      option.value = location.id;
      option.textContent = location.name;
      select.append(option);
    }
  }
  startSelect.disabled = false;
  endSelect.disabled = false;
  submitButton.disabled = false;
}

function drawNetwork(locations, roadRows) {
  if (locations.length === 0) {
    throw new Error('The locations file has no places to display.');
  }
  const locationsById = new Map();
  for (const row of locations) {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!row.id || !row.name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error('The locations file contains a row with invalid coordinates or a missing name.');
    }
    if (locationsById.has(row.id)) {
      throw new Error(`The locations file repeats the ID '${row.id}'.`);
    }
    locationsById.set(row.id, { ...row, lat, lon });
  }

  points = projectLocations([...locationsById.values()]);
  roads = roadRows;
  const pairs = new Map();
  for (const road of roads) {
    const rawMiles = String(road.walkMiles ?? '').trim();
    const miles = rawMiles ? Number(rawMiles) : NaN;
    if (!points.has(road.from) || !points.has(road.to)) {
      throw new Error(`A road refers to an unknown location: ${road.from} to ${road.to}.`);
    }
    if (!Number.isFinite(miles) || miles < 0) {
      throw new Error(`A road has an invalid walking distance: ${road.from} to ${road.to}.`);
    }
    const key = [road.from, road.to].sort().join('\u0000');
    if (!pairs.has(key)) {
      pairs.set(key, { from: road.from, to: road.to, directions: new Set() });
    }
    pairs.get(key).directions.add(`${road.from}\u0000${road.to}`);
  }

  roadLayer.replaceChildren();
  routeLayer.replaceChildren();
  locationLayer.replaceChildren();
  for (const pair of pairs.values()) {
    const start = points.get(pair.from);
    const end = points.get(pair.to);
    const bidirectional = pair.directions.has(`${pair.to}\u0000${pair.from}`);
    const line = element('line', {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      class: bidirectional ? 'road-edge' : 'road-edge one-way'
    });
    if (!bidirectional) line.setAttribute('marker-end', 'url(#one-way-arrow)');
    roadLayer.append(line);
  }

  markerById = new Map();
  for (const point of points.values()) {
    const group = element('g', { class: 'map-place', 'data-location': point.id });
    const circle = element('circle', { cx: point.x, cy: point.y, r: 6, class: 'map-node' });
    const title = element('title');
    title.textContent = point.name;
    circle.append(title);
    group.append(circle);
    locationLayer.append(group);
    markerById.set(point.id, group);
  }

  addLocationOptions([...locationsById.values()]);
  status.textContent = `${points.size} locations · ${pairs.size} road connections`;
}

function clearRoute() {
  routeLayer.replaceChildren();
  routeStops.replaceChildren();
  routeDirections.hidden = true;
  for (const marker of markerById.values()) {
    marker.classList.remove('route-start', 'route-end');
  }
}

function renderStops(route) {
  for (const [index, stop] of buildRouteStops(route.locationIds, [...points.values()], roads).entries()) {
    const item = document.createElement('li');
    item.className = 'route-stop';
    const number = document.createElement('span');
    number.className = 'stop-number';
    number.textContent = String(index + 1);
    const name = document.createElement('span');
    name.className = 'stop-name';
    name.textContent = stop.name;
    const note = document.createElement('span');
    note.className = 'stop-note';
    note.textContent = stop.note;
    item.append(number, name, note);
    routeStops.append(item);
  }
  routeDirections.hidden = false;
}

function showRoute(startId, endId) {
  const startName = points.get(startId).name;
  const endName = points.get(endId).name;
  const route = shortestWalk([...points.values()], roads, startId, endId);
  clearRoute();
  const feedback = routeFeedback(route, startName, endName);
  result.textContent = feedback.text;
  if (feedback.state === 'error') {
    result.dataset.state = 'error';
    return;
  }
  result.removeAttribute('data-state');

  for (let index = 1; index < route.locationIds.length; index++) {
    const from = points.get(route.locationIds[index - 1]);
    const to = points.get(route.locationIds[index]);
    const line = element('line', {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      class: 'road-edge route-edge',
      'marker-end': 'url(#route-arrow)'
    });
    routeLayer.append(line);
  }

  markerById.get(startId).classList.add('route-start');
  markerById.get(endId).classList.add('route-end');
  renderStops(route);
}

clearButton.addEventListener('click', () => {
  clearRouteControls(startSelect, endSelect);
  clearRoute();
  result.removeAttribute('data-state');
  result.textContent = 'Choose a start and destination to plan a walk.';
});

routeForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!startSelect.value || !endSelect.value) {
    result.dataset.state = 'error';
    result.textContent = 'Choose both a start and a destination.';
    return;
  }
  showRoute(startSelect.value, endSelect.value);
});

for (const select of [startSelect, endSelect]) {
  select.addEventListener('change', () => {
    clearRoute();
    result.removeAttribute('data-state');
    result.textContent = 'Choose Find route to update the walk.';
  });
}

async function loadCsv(file) {
  for (const path of [`../data/${file}`, `data/${file}`]) {
    try {
      const response = await fetch(new URL(path, import.meta.url));
      if (response.ok) return response.text();
    } catch {
      // Try the other layout before reporting a load error.
    }
  }
  throw new Error(`Could not load data/${file}.`);
}

async function loadNetwork() {
  try {
    const [locationsText, roadsText] = await Promise.all([
      loadCsv('locations.csv'),
      loadCsv('roads.csv')
    ]);
    drawNetwork(parseCsv(locationsText), parseCsv(roadsText));
  } catch (error) {
    status.dataset.state = 'error';
    status.textContent = error instanceof Error ? error.message : 'Could not load the campus map.';
  }
}

loadNetwork();
