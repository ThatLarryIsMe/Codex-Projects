// POST /api/tts — synthesize one narration chunk. Returns audio/mpeg.
import { PROVIDERS, ProviderError, resolveKey, checkPasscode, parseTtsRequest } from "./_providers.js";

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    if (!checkPasscode(req.headers)) throw new ProviderError(401, "Wrong or missing app passcode", "passcode");
    const p = parseTtsRequest(req.body);
    const key = resolveKey(p.provider, req.headers);
    const out = await PROVIDERS[p.provider].synthesize(key, p);
    res.setHeader("content-type", out.type);
    res.setHeader("x-tts-request-id", out.requestId || "");
    res.setHeader("cache-control", "no-store");
    return res.status(200).send(out.audio);
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 502;
    return res.status(status).json({ error: e.message || "TTS failed", code: e.code || "provider_error" });
  }
}
