// Client for the app's /api functions, plus locally saved settings.
const SETTINGS_KEY = "tellwell.settings";

export function getSettings() {
  try {
    return { keys: {}, passcode: "", rate: 1, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { keys: {}, passcode: "", rate: 1 };
  }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: settings last for this session only
  }
  return next;
}

function headers(provider) {
  const s = getSettings();
  const h = { "content-type": "application/json" };
  if (s.passcode) h["x-app-passcode"] = s.passcode;
  if (provider && s.keys?.[provider]) h["x-provider-key"] = s.keys[provider];
  return h;
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function fail(res) {
  let j = {};
  try {
    j = await res.json();
  } catch {
    // non-JSON error
  }
  throw new ApiError(j.error || `Request failed (${res.status})`, res.status, j.code || (res.status >= 500 ? "server" : "error"));
}

export async function health() {
  try {
    const res = await fetch("api/health", { cache: "no-store" });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { ok: false, providers: {}, passcode: false };
  }
}

export async function synth(params, signal) {
  let res;
  try {
    res = await fetch("api/tts", { method: "POST", headers: headers(params.provider), body: JSON.stringify(params), signal });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError("Network error. Check your connection.", 0, "network");
  }
  if (!res.ok) await fail(res);
  return {
    data: await res.arrayBuffer(),
    type: res.headers.get("content-type") || "audio/mpeg",
    requestId: res.headers.get("x-tts-request-id") || "",
  };
}

export async function listVoices(provider) {
  const res = await fetch(`api/voices?provider=${encodeURIComponent(provider)}`, { headers: headers(provider) });
  if (!res.ok) await fail(res);
  return (await res.json()).voices;
}
