// Shared leaderboards. When the app is hosted with its API (Vercel functions
// in api/, or server.js), each spotter's scores sync so every car on the road
// competes on the same boards. As plain static files, boards stay on-device.
//
// Sync sends each spotter's complete species list for an area (not diffs), so
// retries are idempotent and one car can never overwrite another car's scores.
import { store } from "./store.js";

const DIRTY_KEY = "bd:dirty";
let online = null;

// The website calls its own API; the app-store build (Capacitor) runs from a
// local origin, so it calls the hosted API by absolute URL.
const NATIVE = /^(capacitor|ionic):$/.test(location.protocol) || Boolean(window.Capacitor?.isNativePlatform?.());
export const API_BASE = NATIVE ? "https://birddriving.vercel.app/" : "";

export async function detectServer() {
  if (online !== null) return online;
  try {
    const res = await fetch(`${API_BASE}api/health`, { cache: "no-store" });
    online = res.ok && (await res.json()).ok === true;
  } catch {
    online = false;
  }
  return online;
}

export const isShared = () => online === true;

function readDirty() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DIRTY_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function writeDirty(set) {
  try {
    localStorage.setItem(DIRTY_KEY, JSON.stringify([...set]));
  } catch {
    // Ignore; sync is best-effort.
  }
}

let timer = null;
// Mark a spotter's standing in an area as changed; syncs a few seconds later
// so a burst of spots becomes one request. areaId may be empty (room/trip only).
export function markDirty(playerId, areaId = "") {
  const d = readDirty();
  d.add(`${playerId}|${areaId || ""}`);
  writeDirty(d);
  clearTimeout(timer);
  timer = setTimeout(flush, 4000);
}

function recordFor(playerId, areaId, crewMember) {
  const s = store.get();
  const species = {};
  let areaName = s.areas[areaId]?.title || "";
  const tripKeys = new Map();
  for (const x of s.sightings) {
    if (x.playerId !== playerId) continue;
    tripKeys.set(`${x.areaId}|${x.key}`, x.points);
    if (x.areaId === areaId) {
      species[x.key] = x.points;
      areaName = areaName || x.areaTitle;
    }
  }
  const tripPoints = [...tripKeys.values()].reduce((a, b) => a + b, 0);
  const tripSpecies = new Set([...tripKeys.keys()].map((k) => k.split("|")[1])).size;
  return {
    playerId,
    name: crewMember?.name || "Spotter",
    avatar: crewMember?.avatar || "🐦",
    area: areaId || "",
    areaName,
    species: crewMember ? species : {},
    trip: crewMember ? { count: tripSpecies, points: tripPoints } : { count: 0, points: 0 },
    room: s.room?.code || undefined,
    removed: crewMember ? undefined : true,
  };
}

let flushing = false;
export async function flush() {
  if (flushing || !(await detectServer())) return;
  flushing = true;
  try {
    const dirty = readDirty();
    for (const item of [...dirty]) {
      const [playerId, areaId] = item.split("|");
      const member = store.get().crew.find((c) => c.id === playerId) || null;
      const res = await fetch(`${API_BASE}api/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recordFor(playerId, areaId, member)),
      });
      if (!res.ok && res.status !== 400) break; // retry later; drop malformed items
      dirty.delete(item);
      writeDirty(dirty);
    }
  } catch {
    // Offline: dirty entries wait for the next flush.
  } finally {
    flushing = false;
  }
}

export async function fetchBoard(areaId) {
  if (!(await detectServer())) return null;
  try {
    const res = await fetch(`${API_BASE}api/leaderboard${areaId ? `?area=${encodeURIComponent(areaId)}` : ""}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- rooms

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export const normalizeCode = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export async function createRoom(name) {
  return postJson("api/rooms", { name });
}

// Resolves to the room, null if the code doesn't exist, or throws when offline.
export async function lookupRoom(code) {
  const res = await fetch(`${API_BASE}api/rooms?code=${encodeURIComponent(normalizeCode(code))}`, { cache: "no-store" });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function lastAreaOf(playerId) {
  const mine = store.get().sightings.filter((x) => x.playerId === playerId);
  return mine.length ? mine[mine.length - 1].areaId : "";
}

// Everyone in this car joins; their whole-trip totals show on the room board.
export function joinRoom(room) {
  store.update((s) => (s.room = { code: room.code, name: room.name }));
  store.get().crew.forEach((c) => markDirty(c.id, lastAreaOf(c.id)));
  flush();
}

export async function leaveRoom() {
  const s = store.get();
  const code = s.room?.code;
  if (!code) return;
  store.update((st) => (st.room = null));
  await Promise.all(
    s.crew.map((c) => postJson("api/scores", { ...recordFor(c.id, lastAreaOf(c.id), c), room: undefined, leave: code }).catch(() => {}))
  );
}

export async function fetchRoomBoard(code) {
  try {
    const res = await fetch(`${API_BASE}api/leaderboard?room=${encodeURIComponent(code)}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

addEventListener("online", () => flush());
