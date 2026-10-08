import { parseCsv } from './csv.mjs';
import { shortestWalk } from './routing.mjs';

const roadLayer = document.querySelector('#road-layer');
const routeLayer = document.querySelector('#route-layer');
const locationLayer = document.querySelector('#location-layer');
const status = document.querySelector('#map-status');
const result = document.querySelector('#route-result');
const routeStops = document.querySelector('#route-stops');
const routeForm = document.querySelector('#route-form');
const startSelect = document.querySelector('#route-start');
const endSelect = document.querySelector('#route-end');
const submitButton = document.querySelector('#route-submit');
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
  routeStops.hidden = true;
  for (const marker of markerById.values()) {
    marker.classList.remove('route-start', 'route-end');
  }
}

function roadMiles(fromId, toId) {
  return Math.min(...roads
    .filter(road => road.from === fromId && road.to === toId)
    .map(road => Number(road.walkMiles)));
}

function renderStops(route) {
  let distanceFromStart = 0;
  const lastIndex = route.locationIds.length - 1;
  route.locationIds.forEach((id, index) => {
    if (index > 0) {
      distanceFromStart += roadMiles(route.locationIds[index - 1], id);
    }
    const item = document.createElement('li');
    item.className = 'route-stop';
    const number = document.createElement('span');
    number.className = 'stop-number';
    number.textContent = String(index + 1);
    const name = document.createElement('span');
    name.className = 'stop-name';
    name.textContent = points.get(id).name;
    const note = document.createElement('span');
    note.className = 'stop-note';
    if (lastIndex === 0) {
      note.textContent = 'Start and destination';
    } else if (index === 0) {
      note.textContent = 'Start';
    } else if (index === lastIndex) {
      note.textContent = `Destination · ${distanceFromStart.toFixed(2)} miles total`;
    } else {
      note.textContent = `${distanceFromStart.toFixed(2)} miles from start`;
    }
    item.append(number, name, note);
    routeStops.append(item);
  });
  routeStops.hidden = false;
}

function showRoute(startId, endId) {
  const route = shortestWalk([...points.values()], roads, startId, endId);
  clearRoute();
  result.removeAttribute('data-state');
  if (!route) {
    result.dataset.state = 'error';
    result.textContent = `No walking route connects ${points.get(startId).name} and ${points.get(endId).name}.`;
    return;
  }

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
  result.textContent = `Shortest walk · ${route.distanceMiles.toFixed(2)} miles`;
  renderStops(route);
}

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

async function loadNetwork() {
  try {
    const [locationsResponse, roadsResponse] = await Promise.all([
      fetch('../data/locations.csv'),
      fetch('../data/roads.csv')
    ]);
    if (!locationsResponse.ok || !roadsResponse.ok) {
      throw new Error('Could not load the campus location and road data.');
    }
    const [locationsText, roadsText] = await Promise.all([
      locationsResponse.text(), roadsResponse.text()
    ]);
    drawNetwork(parseCsv(locationsText), parseCsv(roadsText));
  } catch (error) {
    status.dataset.state = 'error';
    status.textContent = error instanceof Error ? error.message : 'Could not load the campus map.';
  }
}

loadNetwork();
