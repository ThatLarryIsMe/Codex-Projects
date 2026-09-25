// Private rooms: a family (or a convoy of cars) shares a 6-character code.
//   POST {name}  -> creates a room, returns {code, name}
//   GET ?code=   -> {code, name} if the room exists
import { put, list } from "@vercel/blob";
import { cors, jsonBody, newRoomCode, parseRoomCode, safeName } from "./_lib.js";

export async function readRoom(code) {
  const { blobs } = await list({ prefix: `r/${code}/meta.json`, limit: 1 });
  if (!blobs.length) return null;
  const r = await fetch(blobs[0].url);
  return r.ok ? r.json() : null;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const code = parseRoomCode(req.query.code);
      if (!code) return res.status(400).json({ error: "invalid code" });
      const room = await readRoom(code);
      return room ? res.status(200).json(room) : res.status(404).json({ error: "no such room" });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "GET or POST" });
    const body = jsonBody(req) || {};
    const name = safeName(body.name, 40, "Road Trip Crew");
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newRoomCode();
      const room = { code, name, created: Date.now() };
      try {
        // allowOverwrite:false makes a code collision throw instead of hijacking a room.
        await put(`r/${code}/meta.json`, JSON.stringify(room), {
          access: "public", addRandomSuffix: false, allowOverwrite: false, contentType: "application/json",
        });
        return res.status(200).json(room);
      } catch (e) {
        if (!/exist/i.test(String(e?.message))) throw e;
      }
    }
    res.status(503).json({ error: "try again" });
  } catch {
    res.status(502).json({ error: "storage unavailable" });
  }
}
