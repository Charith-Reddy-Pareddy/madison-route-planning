const validStatuses = new Set(['closed', 'penalized']);

function roadKey(from, to) {
  return `${from}\u0000${to}`;
}

/** Create an immutable set of directed road closures and cost multipliers. */
export function createClosureOverlay(overrides = []) {
  if (!Array.isArray(overrides)) {
    throw new Error('Closure overrides must be a list.');
  }

  const byRoad = new Map();
  for (const override of overrides) {
    if (!override || typeof override !== 'object') {
      throw new Error('Each closure override must be an object.');
    }
    const from = typeof override.from === 'string' ? override.from.trim() : '';
    const to = typeof override.to === 'string' ? override.to.trim() : '';
    if (!from || !to || from === to) {
      throw new Error('A closure override needs two different road endpoints.');
    }
    if (!validStatuses.has(override.status)) {
      throw new Error("Closure status must be 'closed' or 'penalized'.");
    }

    const key = roadKey(from, to);
    if (byRoad.has(key)) {
      throw new Error(`Road '${from}' to '${to}' has more than one closure override.`);
    }

    let entry = { from, to, status: override.status };
    if (override.status === 'penalized') {
      const multiplier = Number(override.multiplier);
      if (!Number.isFinite(multiplier) || multiplier <= 1) {
        throw new Error('A penalized road needs a finite multiplier greater than 1.');
      }
      entry = { ...entry, multiplier };
    }
    byRoad.set(key, Object.freeze(entry));
  }

  return Object.freeze({
    get(from, to) {
      return byRoad.get(roadKey(from, to)) ?? null;
    },
    list() {
      return [...byRoad.values()];
    },
    size: byRoad.size
  });
}
