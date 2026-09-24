// Shared by the Vercel functions in api/ and the self-hosted server.js.
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
const VALID_POINTS = new Set([1, 3, 5]);
export const AREA_RE = /^-?\d{1,3}_-?\d{1,3}$/;
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;

// A spotter's full standing in one area plus their whole-trip totals.
export function parseScore(b) {
  if (!b || typeof b !== "object") return null;
  const playerId = clean(b.playerId, 64);
  const area = clean(b.area, 12);
  if (!ID_RE.test(playerId) || !AREA_RE.test(area)) return null;
  const species = {};
  const entries = Object.entries(b.species && typeof b.species === "object" ? b.species : {});
  if (entries.length > 300) return null;
  for (const [k, v] of entries) {
    const key = clean(k, 80).toLowerCase();
    if (!key || !VALID_POINTS.has(Number(v))) return null;
    species[key] = Number(v);
  }
  const count = Math.max(0, Math.min(5000, Math.floor(Number(b.trip?.count) || 0)));
  const points = Math.max(0, Math.min(25000, Math.floor(Number(b.trip?.points) || 0)));
  return {
    playerId,
    name: clean(b.name, 18) || "Spotter",
    avatar: clean(b.avatar, 8) || "🐦",
    area,
    areaName: clean(b.areaName, 60),
    species,
    trip: { count, points },
  };
}

export function areaRow(rec) {
  const pts = Object.values(rec.species);
  return {
    playerId: rec.playerId,
    name: rec.name,
    avatar: rec.avatar,
    count: pts.length,
    points: pts.reduce((a, b) => a + b, 0),
  };
}

export function tripRow(rec) {
  return { playerId: rec.playerId, name: rec.name, avatar: rec.avatar, count: rec.trip.count, points: rec.trip.points };
}

export function rank(rows) {
  return rows
    .filter((r) => r && r.count > 0)
    .sort((a, b) => b.points - a.points || b.count - a.count)
    .slice(0, 50);
}
