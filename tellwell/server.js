// Tellwell local server: serves the app and mirrors the /api functions.
// Zero dependencies. `node server.js` (PORT optional). Set ELEVENLABS_API_KEY
// and/or OPENAI_API_KEY, or enter keys in the app's Settings.
// `MOCK_TTS=1 node server.js` replaces narration with tones (needs ffmpeg) for offline testing.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PROVIDERS, ProviderError, resolveKey, checkPasscode, parseTtsRequest, health } from "./api/_providers.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > limit) reject(new ProviderError(413, "Body too large", "bad_request"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

// Mock narration: a soft tone whose length tracks the text (~15 chars/sec).
function mockAudio(text) {
  const secs = Math.max(1, Math.min(120, text.length / 15)).toFixed(2);
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", `sine=frequency=330:duration=${secs}`, "-af", "volume=0.15", "-ar", "44100", "-ac", "1", "-b:a", "64k", "-f", "mp3", "pipe:1"]);
    const parts = [];
    ff.stdout.on("data", (d) => parts.push(d));
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve(Buffer.concat(parts)) : reject(new Error("ffmpeg failed"))));
  });
}

async function api(req, res, url) {
  const headers = req.headers;
  if (url.pathname === "/api/health") return json(res, 200, health());
  if (!checkPasscode(headers)) return json(res, 401, { error: "Wrong or missing app passcode", code: "passcode" });

  if (url.pathname === "/api/tts" && req.method === "POST") {
    const p = parseTtsRequest(await readBody(req));
    let out;
    if (process.env.MOCK_TTS === "1") {
      await new Promise((r) => setTimeout(r, 300));
      out = { audio: await mockAudio(p.text), type: "audio/mpeg", requestId: "mock-" + Math.random().toString(36).slice(2) };
    } else {
      out = await PROVIDERS[p.provider].synthesize(resolveKey(p.provider, headers), p);
    }
    res.writeHead(200, { "content-type": out.type, "x-tts-request-id": out.requestId || "", "cache-control": "no-store" });
    return res.end(out.audio);
  }

  if (url.pathname === "/api/voices") {
    const provider = url.searchParams.get("provider") || "";
    const def = PROVIDERS[provider];
    if (!def?.listVoices) return json(res, 400, { error: "This provider has a fixed voice list" });
    return json(res, 200, { voices: await def.listVoices(resolveKey(provider, headers)) });
  }
  return json(res, 404, { error: "Not found" });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || rel.includes("/api/_") || rel.startsWith("/server.js")) {
    res.writeHead(403);
    return res.end();
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      "content-type": TYPES[ext] || "application/octet-stream",
      "cache-control": rel === "/sw.js" ? "no-cache" : rel.startsWith("/vendor/") ? "public, max-age=86400" : "no-cache",
    });
    fs.createReadStream(file).pipe(res);
  });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      try {
        await api(req, res, url);
      } catch (e) {
        json(res, e.status || 502, { error: e.message || "Server error", code: e.code || "provider_error" });
      }
      return;
    }
    serveStatic(req, res, url);
  })
  .listen(PORT, () => {
    const h = health();
    console.log(`Tellwell on http://localhost:${PORT}`);
    console.log(`  server keys: ElevenLabs ${h.providers.elevenlabs ? "yes" : "no"}, OpenAI ${h.providers.openai ? "yes" : "no"}${h.mock ? "  (MOCK_TTS on)" : ""}`);
  });
