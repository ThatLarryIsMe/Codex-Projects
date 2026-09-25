// Cached proxy for iNaturalist species counts. Area requests are quantized to
// grid-cell centers and the month, so the CDN answers nearly every request and
// iNaturalist sees roughly one call per area per week instead of one per user.
import { cors } from "./_lib.js";

const num = (v, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const lat = num(req.query.lat, -90, 90);
  const lng = num(req.query.lng, -180, 180);
  const radius = [40, 100, 200].includes(Number(req.query.radius)) ? Number(req.query.radius) : null;
  const months = req.query.month ? String(req.query.month).split(",").map(Number) : [];
  if (lat == null || lng == null || !radius || months.some((m) => !(m >= 1 && m <= 12)) || months.length > 3) {
    return res.status(400).json({ error: "invalid" });
  }
  const url =
    `https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=${radius}` +
    `&iconic_taxa=Aves&quality_grade=research&captive=false&per_page=50&locale=en` +
    (months.length ? `&month=${months.join(",")}` : "");
  try {
    const r = await fetch(url, { headers: { "User-Agent": "BirdDriving/1.0 (https://birddriving.vercel.app)" } });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    // Only the fields the app uses; keeps responses small for phones on cell data.
    const results = (d.results || []).map((x) => ({
      count: x.count,
      taxon: x.taxon && {
        id: x.taxon.id,
        name: x.taxon.name,
        rank: x.taxon.rank,
        preferred_common_name: x.taxon.preferred_common_name,
        wikipedia_url: x.taxon.wikipedia_url,
        default_photo: x.taxon.default_photo && {
          medium_url: x.taxon.default_photo.medium_url,
          attribution: x.taxon.default_photo.attribution,
          license_code: x.taxon.default_photo.license_code,
        },
      },
    }));
    res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=86400");
    res.status(200).json({ results });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "upstream unavailable" });
  }
}
