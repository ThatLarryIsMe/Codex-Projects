// BirdDriving server: serves the app and hosts shared area leaderboards.
// Zero dependencies. Run with `node server.js` (PORT env var optional).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseScore, areaRow, tripRow, rank, AREA_RE } from "./api/_lib.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
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

// db.area: { "<area>|<playerId>": areaRow }   db.trip: { playerId: tripRow }
let db = { area: {}, trip: {} };
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

// Very small per-IP rate limit to keep a single client from flooding the board.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 120;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 32768) {
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
    const area = url.searchParams.get("area");
    if (area && !AREA_RE.test(area)) return send(res, 400, { error: "invalid area" });
    const rows = area
      ? Object.entries(db.area).filter(([k]) => k.startsWith(area + "|")).map(([, v]) => v)
      : Object.values(db.trip);
    return send(res, 200, { area: area || null, entries: rank(rows) });
  }
  if (url.pathname === "/api/scores" && req.method === "POST") {
    if (limited(req.socket.remoteAddress)) return send(res, 429, { error: "slow down" });
    let rec;
    try {
      rec = parseScore(await readBody(req));
    } catch {
      return send(res, 400, { error: "bad body" });
    }
    if (!rec) return send(res, 400, { error: "invalid" });
    const row = areaRow(rec);
    const k = `${rec.area}|${rec.playerId}`;
    if (row.count) db.area[k] = row;
    else delete db.area[k];
    if (rec.trip.count) db.trip[rec.playerId] = tripRow(rec);
    else delete db.trip[rec.playerId];
    persist();
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: "not found" });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(ROOT, rel));
  const blocked = file.startsWith(DATA_DIR) || file.startsWith(path.join(ROOT, "api")) || file.startsWith(path.join(ROOT, "node_modules"));
  if (!file.startsWith(ROOT + path.sep) || blocked || path.basename(file) === "server.js") {
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
