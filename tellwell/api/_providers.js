// Text-to-speech provider adapters shared by the Vercel functions and server.js.
// Each adapter turns one narration chunk into audio bytes.
//
// Adding a provider (e.g. Block's Dessa, once it ships a public API): add an
// entry to PROVIDERS with `envKey`, `synthesize()` and optionally `listVoices()`,
// then add its voices to js/voices.js.

const ELEVEN = "https://api.elevenlabs.io/v1";
const OPENAI = "https://api.openai.com/v1";

export class ProviderError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || "provider_error";
  }
}

const clampText = (s, n) => (typeof s === "string" ? s.slice(0, n) : undefined);
const num = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

async function failFrom(res, provider) {
  let detail = "";
  try {
    const body = await res.text();
    try {
      const j = JSON.parse(body);
      detail = j?.detail?.message || j?.detail?.status || j?.error?.message || (typeof j?.detail === "string" ? j.detail : "") || body;
    } catch {
      detail = body;
    }
  } catch {
    // ignore
  }
  detail = String(detail || res.statusText).slice(0, 400);
  let code = "provider_error";
  if (res.status === 401 || res.status === 403) code = "auth";
  else if (res.status === 429) code = /quota|credit/i.test(detail) ? "quota" : "rate_limited";
  else if (/quota|credit|insufficient/i.test(detail)) code = "quota";
  else if (/request[_ ]?id/i.test(detail)) code = "stale_context";
  throw new ProviderError(res.status, `${provider}: ${detail}`, code);
}

export const PROVIDERS = {
  elevenlabs: {
    envKey: "ELEVENLABS_API_KEY",
    async synthesize(key, p) {
      if (!/^[A-Za-z0-9]{8,40}$/.test(p.voice || "")) throw new ProviderError(400, "Invalid ElevenLabs voice id", "bad_request");
      const format = ["mp3_44100_64", "mp3_44100_96", "mp3_44100_128", "mp3_44100_192"].includes(p.format) ? p.format : "mp3_44100_64";
      const body = {
        text: p.text,
        model_id: /^[a-z0-9_.-]{3,60}$/i.test(p.model || "") ? p.model : "eleven_multilingual_v2",
        voice_settings: {
          stability: num(p.stability, 0, 1, 0.5),
          similarity_boost: num(p.similarity, 0, 1, 0.8),
          style: num(p.styleExaggeration, 0, 1, 0),
          use_speaker_boost: true,
          speed: num(p.speed, 0.7, 1.2, 1),
        },
        apply_text_normalization: "auto",
      };
      // Request stitching: tells the model what came before and after so the
      // prosody of consecutive chunks flows like one continuous reading.
      if (Array.isArray(p.previousRequestIds) && p.previousRequestIds.length) {
        body.previous_request_ids = p.previousRequestIds.filter((x) => typeof x === "string" && x.length < 100).slice(-3);
      }
      if (p.previousText) body.previous_text = clampText(p.previousText, 1000);
      if (p.nextText) body.next_text = clampText(p.nextText, 1000);

      const res = await fetch(`${ELEVEN}/text-to-speech/${p.voice}?output_format=${format}`, {
        method: "POST",
        headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify(body),
      });
      if (!res.ok) await failFrom(res, "ElevenLabs");
      return {
        audio: Buffer.from(await res.arrayBuffer()),
        type: "audio/mpeg",
        requestId: res.headers.get("request-id") || "",
        chars: Number(res.headers.get("character-cost")) || undefined,
      };
    },
    async listVoices(key) {
      const res = await fetch(`${ELEVEN}/voices`, { headers: { "xi-api-key": key } });
      if (!res.ok) await failFrom(res, "ElevenLabs");
      const j = await res.json();
      return (j.voices || []).map((v) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels || {},
        description: v.description || v.labels?.description || "",
        previewUrl: v.preview_url || "",
      }));
    },
  },

  openai: {
    envKey: "OPENAI_API_KEY",
    async synthesize(key, p) {
      if (!/^[a-z]{2,20}$/.test(p.voice || "")) throw new ProviderError(400, "Invalid OpenAI voice", "bad_request");
      const model = /^[a-z0-9_.-]{3,60}$/i.test(p.model || "") ? p.model : "gpt-4o-mini-tts";
      const body = { model, voice: p.voice, input: p.text, response_format: "mp3" };
      if (p.instructions && !/^tts-1/.test(model)) {
        // gpt-4o-mini-tts takes direction. Feeding it the previous sentence as
        // context keeps tone and pacing steady from chunk to chunk.
        let instr = String(p.instructions).slice(0, 1500);
        if (p.previousText) instr += `\n\nFor continuity, this passage directly follows: "…${clampText(p.previousText, 400)}"`;
        body.instructions = instr;
      }
      if (/^tts-1/.test(model)) body.speed = num(p.speed, 0.7, 1.2, 1);
      const res = await fetch(`${OPENAI}/audio/speech`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) await failFrom(res, "OpenAI");
      return {
        audio: Buffer.from(await res.arrayBuffer()),
        type: "audio/mpeg",
        requestId: res.headers.get("x-request-id") || "",
      };
    },
  },
};

// Resolve which key to use: a server-side env key wins; otherwise the key the
// user saved in the app's settings (sent per request, never stored server-side).
export function resolveKey(provider, headers) {
  const def = PROVIDERS[provider];
  if (!def) throw new ProviderError(400, "Unknown provider", "bad_request");
  const key = process.env[def.envKey] || headers["x-provider-key"] || "";
  if (!key) throw new ProviderError(401, `No ${provider === "openai" ? "OpenAI" : "ElevenLabs"} API key. Add one in Settings.`, "no_key");
  return key;
}

export function checkPasscode(headers) {
  const want = process.env.APP_PASSCODE;
  if (!want) return true;
  return headers["x-app-passcode"] === want;
}

export function health() {
  return {
    ok: true,
    providers: Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, Boolean(process.env[v.envKey])])),
    passcode: Boolean(process.env.APP_PASSCODE),
    mock: process.env.MOCK_TTS === "1",
  };
}

export function parseTtsRequest(raw) {
  let p;
  try {
    p = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new ProviderError(400, "Bad JSON", "bad_request");
  }
  if (!p || typeof p.text !== "string" || !p.text.trim()) throw new ProviderError(400, "Missing text", "bad_request");
  if (p.text.length > 5000) throw new ProviderError(400, "Chunk too long (max 5000 chars)", "bad_request");
  if (!PROVIDERS[p.provider]) throw new ProviderError(400, "Unknown provider", "bad_request");
  return p;
}
