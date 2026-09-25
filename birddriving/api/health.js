import { cors } from "./_lib.js";

export default function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) });
}
