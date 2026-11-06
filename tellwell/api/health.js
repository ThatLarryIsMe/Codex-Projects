// GET /api/health — which providers have server-side keys, whether a passcode is required.
import { health } from "./_providers.js";

export default function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json(health());
}
