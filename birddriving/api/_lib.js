// Shared by the Vercel functions in api/ and the self-hosted server.js.
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
const VALID_POINTS = new Set([1, 3, 5]);
export const AREA_RE = /^-?\d{1,3}_-?\d{1,3}$/;
// Room codes skip look-alike characters (0/O, 1/I/L) so kids can read them aloud.
export const ROOM_RE = /^[A-HJKMNP-Z2-9]{6}$/;
const ROOM_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;

// Public boards are seen by kids: names containing obvious profanity are
// replaced. A starting point, not full moderation.
const BLOCKED = /(f+u+c+k|sh[i1]t|b[i1]tch|c+u+n+t|d[i1]ck|pen[i1]s|vag[i1]na|puss(y|ie)|asshole|\bass\b|n[i1]gg|fag|slut|whore|porn|sex|rape|nazi|hitler|kill\s*(yo)?u)/i;
export function safeName(s, max, fallback) {
  const v = clean(s, max);
  return !v || BLOCKED.test(v.replace(/[^a-z0-9\s]/gi, "")) ? fallback : v;
}

export function newRoomCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  return code;
}

export function parseRoomCode(s) {
  const code = String(s ?? "").trim().toUpperCase();
  return ROOM_RE.test(code) ? code : null;
}

// A spotter's full standing in one area plus their whole-trip totals.
export function parseScore(b) {
  if (!b || typeof b !== "object") return null;
  const playerId = clean(b.playerId, 64);
  const area = clean(b.area, 12);
  if (!ID_RE.test(playerId) || (area && !AREA_RE.test(area))) return null;
  const room = b.room ? parseRoomCode(b.room) : null;
  const leave = b.leave ? parseRoomCode(b.leave) : null;
  if ((b.room && !room) || (b.leave && !leave)) return null;
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
    name: safeName(b.name, 18, "Spotter"),
    avatar: clean(b.avatar, 8) || "🐦",
    area,
    areaName: clean(b.areaName, 60),
    species,
    trip: { count, points },
    room,
    leave,
    removed: b.removed === true,
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

// Room members show even at zero, so a family sees everyone who joined.
export function rank(rows, { keepZero = false } = {}) {
  return rows
    .filter((r) => r && (keepZero || r.count > 0))
    .sort((a, b) => b.points - a.points || b.count - a.count)
    .slice(0, 50);
}

// The web app calls the API from the same origin; the store apps (Capacitor)
// call it cross-origin, so allow that and answer preflight requests.
export function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function jsonBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" ? body : null;
}
