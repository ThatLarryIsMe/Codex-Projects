// GET the top spotters for an area (?area=<id>) or for whole trips (no area).
// Responses are edge-cached for a minute to keep storage operations low.
import { list } from "@vercel/blob";
import { AREA_RE, rank } from "./_lib.js";

export default async function handler(req, res) {
  const area = String(req.query.area || "");
  if (area && !AREA_RE.test(area)) return res.status(400).json({ error: "invalid area" });
  try {
    const { blobs } = await list({ prefix: area ? `a/${area}/` : "t/", limit: 200 });
    const rows = await Promise.all(
      blobs.map((b) =>
        fetch(b.url)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ area: area || null, entries: rank(rows) });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "storage unavailable" });
  }
}
