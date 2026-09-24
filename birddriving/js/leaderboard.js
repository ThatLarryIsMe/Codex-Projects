// Shared leaderboards. When the app is served by server.js, sightings sync to
// /api and every car on the road competes on the same boards. Served as plain
// static files, the app falls back to the crew-only (this device) boards.
const QUEUE_KEY = "bd:syncQueue";
let online = null;

export async function detectServer() {
  if (online !== null) return online;
  try {
    const res = await fetch("api/health", { cache: "no-store" });
    online = res.ok && (await res.json()).ok === true;
  } catch {
    online = false;
  }
  return online;
}

export const isShared = () => online === true;

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(q) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-500)));
  } catch {
    // Ignore; sync is best-effort.
  }
}

export function queueSighting(op, sighting, player) {
  const q = readQueue();
  q.push({
    op,
    playerId: player.id,
    name: player.name,
    avatar: player.avatar,
    area: sighting.areaId,
    areaName: sighting.areaTitle,
    key: sighting.key,
    points: sighting.points,
  });
  writeQueue(q);
  flush();
}

let flushing = false;
export async function flush() {
  if (flushing || !(await detectServer())) return;
  flushing = true;
  try {
    let q = readQueue();
    while (q.length) {
      const item = q[0];
      const res = await fetch(item.op === "remove" ? "api/sightings/remove" : "api/sightings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok && res.status !== 400) break; // retry later; drop malformed items
      q = q.slice(1);
      writeQueue(q);
    }
  } catch {
    // Offline: the queue waits for the next flush.
  } finally {
    flushing = false;
  }
}

export async function fetchBoard(areaId) {
  if (!(await detectServer())) return null;
  try {
    const res = await fetch(areaId ? `api/leaderboard?area=${encodeURIComponent(areaId)}` : "api/leaderboard", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

addEventListener("online", () => flush());
