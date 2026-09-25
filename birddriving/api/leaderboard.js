// GET the top spotters: ?room=<code> (private room), ?area=<id> (one area),
// or neither (whole trips, global). Edge-cached briefly to keep storage
// operations low; rooms refresh faster because families watch them live.
import { list } from "@vercel/blob";
import { AREA_RE, rank, cors, parseRoomCode } from "./_lib.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const area = String(req.query.area || "");
  const room = req.query.room ? parseRoomCode(req.query.room) : null;
  if ((area && !AREA_RE.test(area)) || (req.query.room && !room)) return res.status(400).json({ error: "invalid" });
  const prefix = room ? `r/${room}/m/` : area ? `a/${area}/` : "t/";
  try {
    const { blobs } = await list({ prefix, limit: 200 });
    const rows = await Promise.all(
      blobs.map((b) =>
        fetch(b.url)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );
    res.setHeader("Cache-Control", `public, s-maxage=${room ? 15 : 60}, stale-while-revalidate=300`);
    res.status(200).json({ area: area || null, room, entries: rank(rows, { keepZero: !!room }) });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "storage unavailable" });
  }
}
