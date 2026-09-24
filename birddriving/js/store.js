// Everything the app remembers between sessions lives in one localStorage record.
const KEY = "bd:state:v1";

export const AVATARS = ["🦉", "🦆", "🐧", "🦩", "🦜", "🐦", "🦅", "🐓", "🦚", "🕊️", "🦢", "🐤"];
export const COLORS = ["#ff7a45", "#2bb3a3", "#6c63ff", "#f2b705", "#e84a7f", "#3c91e6", "#7bb661", "#b86bd6"];

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const fresh = () => ({
  crew: [],
  activeId: null,
  sightings: [],
  areas: {},
  trail: [],
  bingo: {},
  settings: { kid: false, sound: true },
  onboarded: false,
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    // Fall through to a fresh state when storage is unavailable or corrupt.
  }
  return fresh();
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable: keep running in memory.
    }
  }, 150);
}

export const store = {
  get: () => state,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  update(mutator) {
    mutator(state);
    save();
    listeners.forEach((fn) => fn(state));
  },
  reset() {
    state = fresh();
    save();
    listeners.forEach((fn) => fn(state));
  },
  uid,
};

export function addCrew(name, avatar) {
  const member = {
    id: uid(),
    name: name.trim().slice(0, 18) || "Spotter",
    avatar: avatar || AVATARS[state.crew.length % AVATARS.length],
    color: COLORS[state.crew.length % COLORS.length],
  };
  store.update((s) => {
    s.crew.push(member);
    if (!s.activeId) s.activeId = member.id;
  });
  return member;
}

export function removeCrew(id) {
  store.update((s) => {
    s.crew = s.crew.filter((c) => c.id !== id);
    s.sightings = s.sightings.filter((x) => x.playerId !== id);
    if (s.activeId === id) s.activeId = s.crew[0]?.id || null;
  });
}

export function crewById(id) {
  return state.crew.find((c) => c.id === id) || null;
}

export function hasSpotted(key, areaId, playerId) {
  return state.sightings.some(
    (x) => x.key === key && (!areaId || x.areaId === areaId) && (!playerId || x.playerId === playerId)
  );
}

export function spottedByAnyone(key, areaId) {
  return state.sightings.filter((x) => x.key === key && (!areaId || x.areaId === areaId));
}

// Aggregate standings for the crew. areaId = null gives the whole trip.
export function standings(areaId) {
  const rows = new Map(state.crew.map((c) => [c.id, { ...c, species: new Set(), points: 0 }]));
  for (const x of state.sightings) {
    if (areaId && x.areaId !== areaId) continue;
    const r = rows.get(x.playerId);
    if (!r) continue;
    r.species.add(x.key);
    r.points += x.points;
  }
  return [...rows.values()]
    .map((r) => ({ ...r, count: r.species.size }))
    .sort((a, b) => b.points - a.points || b.count - a.count || a.name.localeCompare(b.name));
}
