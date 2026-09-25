// Network data sources, each with a local cache so the app keeps working in
// dead zones. Every function resolves (never rejects) with a best-effort value.
import { BIRDS, RARITY, curatedForRegion, findCurated, guessGroup, regionFor, REGION_NAMES } from "./birds.js";
import { API_BASE } from "./leaderboard.js";

const CELL = 0.5; // degrees; one "area" is roughly a 35-mile square
const TTL_AREA = 1000 * 60 * 60 * 24 * 7;
const TTL_WIKI = 1000 * 60 * 60 * 24 * 30;

function cacheGet(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (ttl && Date.now() - t > ttl) return null;
    return v;
  } catch {
    return null;
  }
}

function cacheSet(key, v) {
  const value = JSON.stringify({ t: Date.now(), v });
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full: drop the oldest half of cached areas/descriptions and retry once.
    try {
      pruneCache();
      localStorage.setItem(key, value);
    } catch {
      // Still no room (or storage blocked): the app works without caching.
    }
  }
}

function pruneCache() {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!/^bd:(birds|wiki|sound|name):/.test(k)) continue;
    let t = 0;
    try {
      t = JSON.parse(localStorage.getItem(k)).t || 0;
    } catch {
      // Unreadable entry: treat as oldest.
    }
    entries.push([t, k]);
  }
  entries.sort((a, b) => a[0] - b[0]);
  entries.slice(0, Math.ceil(entries.length / 2)).forEach(([, k]) => localStorage.removeItem(k));
}

async function fetchJson(url, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function cellFor(lat, lng) {
  const la = Math.floor(lat / CELL);
  const ln = Math.floor(lng / CELL);
  return {
    id: `${la}_${ln}`,
    center: [(la + 0.5) * CELL, (ln + 0.5) * CELL],
    bounds: [[la * CELL, ln * CELL], [(la + 1) * CELL, (ln + 1) * CELL]],
  };
}

function fmtCoord(lat, lng) {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(1)}°${lng >= 0 ? "E" : "W"}`;
}

export async function areaName(cell) {
  const key = `bd:name:${cell.id}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const [lat, lng] = cell.center;
  try {
    const d = await fetchJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    const county = (d.localityInfo?.administrative || []).find((a) => a.adminLevel === 6)?.name;
    const place = d.city || d.locality || county || "";
    const sub = d.principalSubdivision || d.countryName || "";
    const name = {
      title: place || sub || fmtCoord(lat, lng),
      subtitle: place ? [sub, d.countryCode].filter(Boolean).join(", ") : d.countryName || "",
    };
    cacheSet(key, name);
    return name;
  } catch {
    return { title: fmtCoord(lat, lng), subtitle: REGION_NAMES[regionFor(lat, lng)] };
  }
}

function rarityFromRank(i, n) {
  const p = n <= 1 ? 0 : i / (n - 1);
  if (p < 0.4) return 1;
  if (p < 0.75) return 3;
  return 5;
}

function wikiTitleFromUrl(url) {
  if (!url) return null;
  const m = url.match(/\/wiki\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function fromCurated(b, extra = {}) {
  return {
    key: b.sci.toLowerCase(),
    id: b.id,
    name: b.name,
    sci: b.sci,
    wiki: b.wiki,
    rarity: b.rarity,
    size: b.size,
    group: b.group,
    carSpot: b.carSpot,
    lookFor: b.lookFor,
    kidFact: b.kidFact,
    about: b.about,
    colors: b.colors,
    photo: null,
    photoCredit: null,
    curated: true,
    ...extra,
  };
}

function curatedList(region) {
  const list = curatedForRegion(region);
  return list.map((b) => fromCurated(b));
}

// Birds observed near the area center (iNaturalist research-grade sightings),
// enriched with curated roadside notes. Falls back to the curated regional list.
const MIN_SPECIES = 12; // below this, search wider before trusting the list
const RADII_KM = [40, 100, 200];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// This month plus its neighbors, so lists reflect who is actually around now
// (a winter-only duck shouldn't show up in July).
export function seasonMonths(d = new Date()) {
  const m = d.getMonth() + 1;
  return [((m + 10) % 12) + 1, m, (m % 12) + 1];
}

export function seasonLabel(months) {
  return `${MONTH_NAMES[months[0] - 1]}–${MONTH_NAMES[months[2] - 1]}`;
}

// Prefer our cached proxy (one upstream call per area per week for everyone);
// fall back to iNaturalist directly when the proxy isn't there (static hosting).
let proxyOk = true;
async function speciesCounts(lat, lng, radius, months) {
  const q = `lat=${lat}&lng=${lng}&radius=${radius}` + (months ? `&month=${months.join(",")}` : "");
  let d = null;
  if (proxyOk) {
    try {
      d = await fetchJson(`${API_BASE}api/birds?${q}`, 12000);
    } catch (e) {
      if (/HTTP 404/.test(String(e?.message))) proxyOk = false;
    }
  }
  if (!d) {
    d = await fetchJson(
      `https://api.inaturalist.org/v1/observations/species_counts?${q}` +
        `&iconic_taxa=Aves&quality_grade=research&captive=false&per_page=50&locale=en`,
      12000
    );
  }
  return (d.results || []).filter((r) => r.taxon && r.taxon.rank === "species");
}

function liveBird(r, i, n) {
  const t = r.taxon;
  const name = t.preferred_common_name ? titleCase(t.preferred_common_name) : t.name;
  const photo = t.default_photo?.medium_url || null;
  const live = {
    observations: r.count,
    photo,
    photoLarge: photo ? photo.replace("/medium.", "/large.") : null,
    photoCredit: t.default_photo?.attribution || null,
    taxonId: t.id,
  };
  const c = findCurated(t.name, name);
  if (c) return fromCurated(c, { ...live, rarity: rarityFromRank(i, n) });
  return {
    key: t.name.toLowerCase(),
    id: `inat-${t.id}`,
    name,
    sci: t.name,
    wiki: wikiTitleFromUrl(t.wikipedia_url) || t.name.replace(/ /g, "_"),
    rarity: rarityFromRank(i, n),
    size: null,
    group: guessGroup(name),
    carSpot: /hawk|vulture|eagle|heron|egret|crow|raven|blackbird|swallow|goose|crane|kestrel|magpie|meadowlark|pelican|gull/i.test(name),
    lookFor: null,
    kidFact: null,
    about: null,
    colors: null,
    curated: false,
    ...live,
  };
}

// Birds reported near the area center this season on iNaturalist (research-
// grade, wild), enriched with curated roadside notes. Works anywhere on Earth
// with signal. Sparse areas search wider; thin lists are topped up from the
// regional field guide; with no signal it falls back to the guide entirely.
export async function areaBirds(cell) {
  const months = seasonMonths();
  const key = `bd:birds:v3:${cell.id}:${months[1]}`;
  const cached = cacheGet(key, TTL_AREA);
  if (cached) return cached;
  const [lat, lng] = cell.center;
  const region = regionFor(lat, lng);

  let results = [];
  let radiusKm = RADII_KM[0];
  let seasonal = true;
  try {
    for (const r of RADII_KM) {
      const got = await speciesCounts(lat, lng, r, months);
      if (got.length >= results.length) {
        results = got;
        radiusKm = r;
      }
      if (results.length >= MIN_SPECIES) break;
    }
    if (results.length < MIN_SPECIES) {
      // Very remote or little-birded: use all-year sightings rather than a thin list.
      const all = await speciesCounts(lat, lng, RADII_KM[RADII_KM.length - 1], null);
      if (all.length > results.length) {
        results = all;
        radiusKm = RADII_KM[RADII_KM.length - 1];
        seasonal = false;
      }
    }
  } catch {
    // Keep whatever a smaller radius already returned; otherwise fall back below.
  }
  if (!results.length) return { source: "guide", region, birds: curatedList(region) };

  const birds = results.map((r, i) => liveBird(r, i, results.length));
  if (birds.length < 20) {
    const have = new Set(birds.map((b) => b.key));
    for (const b of curatedList(region)) {
      if (!have.has(b.key)) birds.push({ ...b, fromGuide: true });
    }
  }
  const out = { source: "live", region, birds, radiusKm, seasonal, months };
  cacheSet(key, out);
  return out;
}

// Warm the cache for an area the car is heading toward, including its photos,
// so it still works if signal drops by the time you get there.
export async function prefetchArea(cell) {
  const months = seasonMonths();
  if (cacheGet(`bd:birds:v3:${cell.id}:${months[1]}`, TTL_AREA)) return false;
  const [, data] = await Promise.all([areaName(cell), areaBirds(cell)]);
  if (data.source !== "live") return false;
  data.birds.slice(0, 16).forEach((b) => {
    if (b.photo) new Image().src = b.photo;
  });
  return true;
}

function titleCase(s) {
  return s.replace(/(^|[\s-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

// Wikipedia summary: hero photo + readable description.
export async function wikiSummary(title) {
  if (!title) return null;
  const key = `bd:wiki:${title}`;
  const cached = cacheGet(key, TTL_WIKI);
  if (cached) return cached;
  try {
    const d = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const out = {
      extract: d.extract || "",
      thumb: d.thumbnail?.source || null,
      image: d.originalimage?.source || d.thumbnail?.source || null,
      url: d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
    // Very large originals slow down phones on cell data; use a standard 960px thumb instead.
    if (out.thumb && (d.originalimage?.width || 0) > 960) out.image = out.thumb.replace(/\/(\d+)px-/, "/960px-");
    cacheSet(key, out);
    return out;
  } catch {
    return null;
  }
}

// A recording of the bird's song or call from iNaturalist (Creative Commons
// licensed, research-grade observations, most-liked first).
export async function birdSound(bird) {
  const key = `bd:sound:${bird.sci}`;
  const cached = cacheGet(key, TTL_WIKI);
  if (cached) return cached.url ? cached : null;
  const q = bird.taxonId ? `taxon_id=${bird.taxonId}` : `taxon_name=${encodeURIComponent(bird.sci)}`;
  try {
    const d = await fetchJson(
      `https://api.inaturalist.org/v1/observations?${q}&sounds=true&quality_grade=research&order_by=votes&per_page=15&locale=en`
    );
    const playable = /audio\/(mpeg|mp3|mp4|x-m4a|aac|wav|x-wav)/;
    const sounds = (d.results || []).flatMap((o) =>
      (o.sounds || [])
        .filter((s) => s.file_url && s.license_code && (playable.test(s.file_content_type || "") || /\.(mp3|m4a|wav)(\?|$)/i.test(s.file_url)))
        .map((s) => ({ url: s.file_url, credit: s.attribution || "iNaturalist", page: o.uri || null, mp3: /mpeg|mp3/.test(s.file_content_type || s.file_url) }))
    );
    const best = sounds.find((s) => s.mp3) || sounds[0] || null;
    cacheSet(key, best || { url: null });
    return best;
  } catch {
    return null; // offline: try again next time
  }
}

export const RARITY_INFO = RARITY;
export { BIRDS };
