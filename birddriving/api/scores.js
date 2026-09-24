// POST a spotter's standing for one area. Stored as two small JSON blobs:
//   a/<area>/<player>.json  (area board row)   t/<player>.json  (trip board row)
// Each car only ever writes its own spotters' files, so cars can't clobber each other.
import { put, del } from "@vercel/blob";
import { parseScore, areaRow, tripRow } from "./_lib.js";

const OPTS = { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "bad body" });
    }
  }
  const rec = parseScore(body);
  if (!rec) return res.status(400).json({ error: "invalid" });
  const row = areaRow(rec);
  const areaPath = `a/${rec.area}/${rec.playerId}.json`;
  const tripPath = `t/${rec.playerId}.json`;
  try {
    const jobs = [];
    if (row.count) jobs.push(put(areaPath, JSON.stringify({ ...row, areaName: rec.areaName }), OPTS));
    else jobs.push(del(areaPath).catch(() => {}));
    if (rec.trip.count) jobs.push(put(tripPath, JSON.stringify(tripRow(rec)), OPTS));
    else jobs.push(del(tripPath).catch(() => {}));
    await Promise.all(jobs);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "storage unavailable" });
  }
}
