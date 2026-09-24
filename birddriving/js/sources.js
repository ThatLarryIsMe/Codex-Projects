// Network data sources, each with a local cache so the app keeps working in
// dead zones. Every function resolves (never rejects) with a best-effort value.
import { BIRDS, RARITY, curatedForRegion, findCurated, guessGroup, regionFor, REGION_NAMES } from "./birds.js";

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
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), v }));
  } catch {
    // Storage full or blocked: the app still works, just without caching.
  }
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
export async function areaBirds(cell) {
  const key = `bd:birds:v2:${cell.id}`;
  const cached = cacheGet(key, TTL_AREA);
  if (cached) return cached;
  const [lat, lng] = cell.center;
  const region = regionFor(lat, lng);
  try {
    const url =
      `https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=40` +
      `&iconic_taxa=Aves&quality_grade=research&captive=false&per_page=40&locale=en`;
    const d = await fetchJson(url, 12000);
    const results = (d.results || []).filter((r) => r.taxon && r.taxon.rank === "species");
    if (results.length < 6) throw new Error("too few results");
    const n = results.length;
    const birds = results.map((r, i) => {
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
    });
    const out = { source: "live", region, birds };
    cacheSet(key, out);
    return out;
  } catch {
    return { source: "guide", region, birds: curatedList(region) };
  }
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

export const RARITY_INFO = RARITY;
export { BIRDS };
