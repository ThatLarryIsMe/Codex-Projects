// End-of-trip share card: a 1080×1350 image (the portrait size Instagram and
// most chat apps show uncropped) with the route, stats, best find and crew.
import { sketchDataUri } from "./sketch.js";

const W = 1080;
const H = 1350;
const RARITY_NAME = { 1: "Common", 3: "Uncommon", 5: "Rare" };

function loadImage(src, cors) {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

function drawRoute(ctx, trail, sightings, box) {
  const pts = trail.length ? trail : sightings.filter((s) => s.lat != null).map((s) => [s.lat, s.lng]);
  roundRect(ctx, box.x, box.y, box.w, box.h, 36);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();
  if (!pts.length) return;
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const minX = Math.min(...lngs) * k;
  const maxX = Math.max(...lngs) * k;
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);
  const pad = 70;
  const scale = Math.min((box.w - pad * 2) / Math.max(maxX - minX, 0.02), (box.h - pad * 2) / Math.max(maxY - minY, 0.02));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const proj = ([lat, lng]) => [cx + (lng * k - (minX + maxX) / 2) * scale, cy - (lat - (minY + maxY) / 2) * scale];

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(15,59,58,0.55)";
  ctx.lineWidth = 22;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(...proj(p)) : ctx.moveTo(...proj(p))));
  ctx.stroke();
  ctx.strokeStyle = "#ffc857";
  ctx.lineWidth = 8;
  ctx.setLineDash([2, 22]);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const s of sightings) {
    if (s.lat == null) continue;
    const [x, y] = proj([s.lat, s.lng]);
    ctx.fillStyle = s.rarity === 5 ? "#ffc857" : "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, s.rarity === 5 ? 12 : 8, 0, Math.PI * 2);
    ctx.fill();
  }
  const [sx, sy] = proj(pts[0]);
  const [ex, ey] = proj(pts[pts.length - 1]);
  ctx.font = "56px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📍", sx, sy - 24);
  ctx.fillText("🚗", ex, ey);
  ctx.restore();
}

export async function makeShareCard({ trail, sightings, stats, crew, areaTitles }) {
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load("800 80px Fraunces"),
      document.fonts.load("800 40px Nunito"),
    ]).catch(() => {});
  }
  const display = "Fraunces, Georgia, serif";
  const ui = "Nunito, system-ui, sans-serif";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#ffb56b");
  bg.addColorStop(0.3, "#f5795a");
  bg.addColorStop(0.62, "#6b3f6e");
  bg.addColorStop(1, "#102f3a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,238,200,0.35)";
  ctx.beginPath();
  ctx.arc(960, 90, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 34px ${ui}`;
  ctx.fillText("BIRDDRIVING", 80, 110);
  ctx.font = `800 92px ${display}`;
  const first = areaTitles[0];
  const last = areaTitles[areaTitles.length - 1];
  const title = first && last && first !== last ? `${first} → ${last}` : first ? `Birding ${first}` : "Our Road Trip";
  ctx.fillText(fitText(ctx, title, W - 160), 80, 210);
  ctx.font = `700 36px ${ui}`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(`${stats.species} bird species spotted from the road`, 80, 268);

  drawRoute(ctx, trail, sightings, { x: 60, y: 310, w: W - 120, h: 420 });

  const cells = [
    [stats.species, "SPECIES"],
    [stats.points, "POINTS"],
    [stats.visited, "AREAS"],
    [Math.round(stats.miles), "MILES"],
  ];
  const cw = (W - 120 - 3 * 20) / 4;
  cells.forEach(([v, l], i) => {
    const x = 60 + i * (cw + 20);
    roundRect(ctx, x, 760, cw, 150, 28);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = `800 64px ${display}`;
    ctx.fillText(String(v), x + cw / 2, 848);
    ctx.font = `800 24px ${ui}`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(l, x + cw / 2, 888);
  });
  ctx.textAlign = "left";

  // Best find: rarest, then most recent.
  const best = [...sightings].sort((a, b) => b.rarity - a.rarity || b.t - a.t)[0];
  roundRect(ctx, 60, 940, W - 120, 260, 36);
  ctx.fillStyle = "#fff8ec";
  ctx.fill();
  if (best) {
    const photo = (best.photo && (await loadImage(best.photo, true))) || (await loadImage(sketchDataUri(best), false));
    ctx.save();
    roundRect(ctx, 90, 970, 200, 200, 28);
    ctx.clip();
    if (photo) {
      const s = Math.max(200 / photo.width, 200 / photo.height);
      ctx.drawImage(photo, 90 + (200 - photo.width * s) / 2, 970 + (200 - photo.height * s) / 2, photo.width * s, photo.height * s);
    }
    ctx.restore();
    ctx.fillStyle = "#1f8a7d";
    ctx.font = `900 26px ${ui}`;
    ctx.fillText(`BEST FIND · ${RARITY_NAME[best.rarity] || ""}`.toUpperCase(), 320, 1030);
    ctx.fillStyle = "#1d2a2c";
    ctx.font = `800 60px ${display}`;
    ctx.fillText(fitText(ctx, best.name, W - 420), 320, 1100);
    ctx.font = `700 30px ${ui}`;
    ctx.fillStyle = "#5d6a6b";
    ctx.fillText(fitText(ctx, `near ${best.areaTitle}`, W - 420), 320, 1148);
  } else {
    ctx.fillStyle = "#1d2a2c";
    ctx.font = `800 48px ${display}`;
    ctx.fillText("The hunt is just beginning…", 100, 1085);
  }

  // Crew podium.
  const top = crew.slice(0, 3);
  ctx.font = `800 34px ${ui}`;
  let x = 60;
  top.forEach((c, i) => {
    const label = `${["🥇", "🥈", "🥉"][i]} ${c.avatar} ${c.name} ${c.points}`;
    const w = Math.min(ctx.measureText(label).width + 48, (W - 120 - 40) / Math.max(top.length, 1));
    roundRect(ctx, x, 1225, w, 70, 35);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(fitText(ctx, label, w - 40), x + 24, 1272);
    x += w + 20;
  });

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
