// GET /api/voices?provider=elevenlabs — the voices in the user's own account.
import { PROVIDERS, ProviderError, resolveKey, checkPasscode } from "./_providers.js";

export default async function handler(req, res) {
  try {
    if (!checkPasscode(req.headers)) throw new ProviderError(401, "Wrong or missing app passcode", "passcode");
    const provider = String(req.query.provider || "");
    const def = PROVIDERS[provider];
    if (!def?.listVoices) throw new ProviderError(400, "This provider has a fixed voice list", "bad_request");
    const voices = await def.listVoices(resolveKey(provider, req.headers));
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ voices });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message, code: e.code || "provider_error" });
  }
}
