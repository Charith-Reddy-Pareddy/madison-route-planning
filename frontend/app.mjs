import { parseCsv } from './csv.mjs';

const map = document.querySelector('#network-map');
const roadLayer = document.querySelector('#road-layer');
const locationLayer = document.querySelector('#location-layer');
const status = document.querySelector('#map-status');
const svgNamespace = 'http://www.w3.org/2000/svg';
const width = 1000;
const height = 560;
const padding = 42;

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
  const points = locations.map(location => ({
    ...location,
    projectedX: location.lon * longitudeScale,
    projectedY: location.lat
  }));
  const minX = Math.min(...points.map(point => point.projectedX));
  const maxX = Math.max(...points.map(point => point.projectedX));
  const minY = Math.min(...points.map(point => point.projectedY));
  const maxY = Math.max(...points.map(point => point.projectedY));
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  return new Map(points.map(point => [point.id, {
    ...point,
    x: offsetX + (point.projectedX - minX) * scale,
    y: height - offsetY - (point.projectedY - minY) * scale
  }]));
}

function drawNetwork(locations, roads) {
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

  const points = projectLocations([...locationsById.values()]);
  const pairs = new Map();
  for (const road of roads) {
    if (!points.has(road.from) || !points.has(road.to)) {
      throw new Error(`A road refers to an unknown location: ${road.from} to ${road.to}.`);
    }
    const key = [road.from, road.to].sort().join('\u0000');
    if (!pairs.has(key)) {
      pairs.set(key, { from: road.from, to: road.to, directions: new Set() });
    }
    pairs.get(key).directions.add(`${road.from}\u0000${road.to}`);
  }

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
    if (!bidirectional) {
      line.setAttribute('marker-end', 'url(#one-way-arrow)');
    }
    roadLayer.append(line);
  }

  for (const point of points.values()) {
    const group = element('g', { class: 'map-place' });
    const circle = element('circle', { cx: point.x, cy: point.y, r: 6, class: 'map-node' });
    const title = element('title');
    title.textContent = point.name;
    circle.append(title);
    group.append(circle);
    locationLayer.append(group);
  }

  status.textContent = `${points.size} locations · ${pairs.size} road connections`;
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
