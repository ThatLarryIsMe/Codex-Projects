// POST a spotter's standing. Stored as small JSON blobs, one per spotter:
//   a/<area>/<player>.json      area board row
//   t/<player>.json             whole-trip (global) board row
//   r/<room>/m/<player>.json    private room board row
// Each car only ever writes its own spotters' files, so cars can't clobber each other.
import { put, del } from "@vercel/blob";
import { parseScore, areaRow, tripRow, cors, jsonBody } from "./_lib.js";

const OPTS = { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 };
const drop = (path) => del(path).catch(() => {});

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = jsonBody(req);
  if (!body) return res.status(400).json({ error: "bad body" });
  const rec = parseScore(body);
  if (!rec) return res.status(400).json({ error: "invalid" });
  const trip = tripRow(rec);
  const jobs = [];
  if (rec.area) {
    const row = areaRow(rec);
    const areaPath = `a/${rec.area}/${rec.playerId}.json`;
    jobs.push(row.count ? put(areaPath, JSON.stringify({ ...row, areaName: rec.areaName }), OPTS) : drop(areaPath));
  }
  const tripPath = `t/${rec.playerId}.json`;
  jobs.push(trip.count ? put(tripPath, JSON.stringify(trip), OPTS) : drop(tripPath));
  if (rec.room) {
    const roomPath = `r/${rec.room}/m/${rec.playerId}.json`;
    jobs.push(rec.removed ? drop(roomPath) : put(roomPath, JSON.stringify({ ...trip, updated: Date.now() }), OPTS));
  }
  if (rec.leave && rec.leave !== rec.room) jobs.push(drop(`r/${rec.leave}/m/${rec.playerId}.json`));
  try {
    await Promise.all(jobs);
    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ error: "storage unavailable" });
  }
}
