// BirdDriving server: serves the app and hosts shared area leaderboards.
// Zero dependencies. Run with `node server.js` (PORT env var optional).
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "leaderboard.json");
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// db.sightings: { "<area>|<playerId>|<speciesKey>": points }
// db.players:   { playerId: { name, avatar } }
// db.areas:     { area: name }
let db = { sightings: {}, players: {}, areas: {} };
try {
  db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
} catch {
  // First run: start empty.
}

let writeTimer = null;
function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 250);
}

const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
const VALID_POINTS = new Set([1, 3, 5]);

// Very small per-IP rate limit to keep a single client from flooding the board.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 120;
}

function board(area) {
  const rows = new Map();
  for (const [k, points] of Object.entries(db.sightings)) {
    const [a, playerId] = k.split("|");
    if (area && a !== area) continue;
    const p = db.players[playerId];
    if (!p) continue;
    const r = rows.get(playerId) || { playerId, name: p.name, avatar: p.avatar, count: 0, points: 0 };
    r.count += 1;
    r.points += points;
    rows.set(playerId, r);
  }
  const entries = [...rows.values()].sort((a, b) => b.points - a.points || b.count - a.count).slice(0, 50);
  return { area: area || null, areaName: area ? db.areas[area] || null : null, entries };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 4096) {
        reject(new Error("too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

async function api(req, res, url) {
  if (url.pathname === "/api/health") return send(res, 200, { ok: true });
  if (url.pathname === "/api/leaderboard" && req.method === "GET") {
    return send(res, 200, board(clean(url.searchParams.get("area"), 40) || null));
  }
  if ((url.pathname === "/api/sightings" || url.pathname === "/api/sightings/remove") && req.method === "POST") {
    if (limited(req.socket.remoteAddress)) return send(res, 429, { error: "slow down" });
    let b;
    try {
      b = await readBody(req);
    } catch {
      return send(res, 400, { error: "bad body" });
    }
    const playerId = clean(b.playerId, 64);
    const area = clean(b.area, 40);
    const key = clean(b.key, 80).toLowerCase();
    const points = Number(b.points);
    if (!playerId || !/^-?\d+_-?\d+$/.test(area) || !key) return send(res, 400, { error: "invalid" });
    const id = `${area}|${playerId}|${key}`;
    if (url.pathname.endsWith("/remove")) {
      delete db.sightings[id];
    } else {
      if (!VALID_POINTS.has(points)) return send(res, 400, { error: "invalid points" });
      db.players[playerId] = { name: clean(b.name, 18) || "Spotter", avatar: clean(b.avatar, 8) || "🐦" };
      if (b.areaName) db.areas[area] = clean(b.areaName, 60);
      db.sightings[id] = points;
    }
    persist();
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: "not found" });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || file.startsWith(DATA_DIR) || path.basename(file) === "server.js") {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      api(req, res, url).catch(() => send(res, 500, { error: "server error" }));
    } else {
      serveStatic(req, res, url);
    }
  })
  .listen(PORT, () => console.log(`BirdDriving running at http://localhost:${PORT}`));
