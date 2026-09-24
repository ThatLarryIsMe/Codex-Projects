import { BIRDS, RARITY, SIZE_LABELS, GROUP_LABELS, REGION_NAMES } from "./birds.js";
import { cellFor, areaName, areaBirds, wikiSummary, birdSound } from "./sources.js";
import { makeShareCard } from "./share.js";
import { store, addCrew, removeCrew, crewById, standings, AVATARS } from "./store.js";
import { sketchDataUri } from "./sketch.js";
import { chirp, confetti, vibrate } from "./fx.js";
import { detectServer, isShared, markDirty, fetchBoard, flush } from "./leaderboard.js";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

const view = {
  cell: null,
  area: null,
  birds: [],
  source: null,
  filter: "todo",
  tab: "look",
  boardScope: "area",
  pos: null,
  heading: 0,
  following: true,
  watchId: null,
  demo: null,
  manual: false,
  openBird: null,
};

// ---------------------------------------------------------------- map

const map = L.map("map", { zoomControl: false, worldCopyJump: true }).setView([39.5, -98.35], 4);
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
let tiles = null;
function setTiles() {
  tiles?.remove();
  const style = darkQuery.matches ? "dark_all" : "rastertiles/voyager";
  tiles = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`, {
    subdomains: "abcd",
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
}
setTiles();
darkQuery.addEventListener?.("change", setTiles);

const trailLine = L.polyline([], {
  color: "#ff7a45", weight: 5, opacity: 0.85, dashArray: "1 11", lineCap: "round",
}).addTo(map);
const cellRect = L.rectangle([[0, 0], [0, 0]], {
  color: "#1f8a7d", weight: 2, dashArray: "6 8", fillColor: "#1f8a7d", fillOpacity: 0.05, interactive: false,
});
const sightingLayer = L.layerGroup().addTo(map);
const meIcon = L.divIcon({
  className: "",
  html: `<div class="me-marker"><div class="me-pulse"></div><div class="me-car"><svg viewBox="0 0 24 24"><path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7Z"/></svg></div></div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});
let meMarker = null;

map.on("dragstart", () => setFollowing(false));
map.on("click", (e) => {
  if (view.manual && !view.demo) onPosition(e.latlng.lat, e.latlng.lng, null);
});

// Center on a point within the part of the map the sheet/panel doesn't cover.
function centerOn(lat, lng, zoom, animate = true) {
  const z = zoom ?? map.getZoom();
  const r = $("#sheet").getBoundingClientRect();
  const offset = innerWidth >= 900 ? [-r.right / 2, 0] : [0, Math.max(0, innerHeight - r.top) / 2];
  const target = map.unproject(map.project([lat, lng], z).add(offset), z);
  map.setView(target, z, { animate, duration: 0.5 });
}

function setFollowing(on) {
  view.following = on;
  $("#recenterBtn").classList.toggle("following", on);
  if (on && view.pos) centerOn(view.pos.lat, view.pos.lng, Math.max(map.getZoom(), 11));
}
$("#recenterBtn").addEventListener("click", () => setFollowing(true));

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearing(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
  const x =
    Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
    Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ---------------------------------------------------------------- location

function onPosition(lat, lng, heading) {
  const prev = view.pos;
  view.pos = { lat, lng };
  if (heading != null && !Number.isNaN(heading)) view.heading = heading;
  else if (prev && haversineKm([prev.lat, prev.lng], [lat, lng]) > 0.02) view.heading = bearing([prev.lat, prev.lng], [lat, lng]);

  if (!meMarker) meMarker = L.marker([lat, lng], { icon: meIcon, keyboard: false, zIndexOffset: 1000 }).addTo(map);
  else meMarker.setLatLng([lat, lng]);
  const car = meMarker.getElement()?.querySelector(".me-car");
  if (car) car.style.transform = `rotate(${view.heading}deg)`;

  if (view.following) {
    centerOn(lat, lng, prev ? undefined : 11, !!prev);
  }

  const trail = store.get().trail;
  const last = trail[trail.length - 1];
  if (!last || haversineKm(last, [lat, lng]) > 0.25) {
    store.update((s) => {
      s.trail.push([+lat.toFixed(5), +lng.toFixed(5)]);
      if (s.trail.length > 4000) s.trail.splice(0, s.trail.length - 4000);
    });
    trailLine.addLatLng([lat, lng]);
  }

  const cell = cellFor(lat, lng);
  if (!view.cell || cell.id !== view.cell.id) enterArea(cell);
}

function startGeo() {
  stopDemo(false);
  view.manual = false;
  if (!navigator.geolocation) return locationUnavailable();
  if (view.watchId != null) navigator.geolocation.clearWatch(view.watchId);
  setPill("Finding you…", "Asking for your location", true);
  view.watchId = navigator.geolocation.watchPosition(
    (p) => {
      $("#locBanner").hidden = true;
      view.manual = false;
      onPosition(p.coords.latitude, p.coords.longitude, p.coords.heading);
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED || !view.pos) locationUnavailable();
    },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
  );
}

function locationUnavailable() {
  if (view.demo) return;
  view.manual = true;
  $("#locBanner").hidden = false;
  if (!view.pos) setPill("Where are you?", "Tap the map to pick a spot", false);
}

$("#retryLocBtn").addEventListener("click", startGeo);
$("#bannerDemoBtn").addEventListener("click", startDemo);

// ---------------------------------------------------------------- demo drive

const DEMO_ROUTE = [
  [34.0522, -118.2437], [34.1083, -117.2898], [34.5362, -117.2928], [34.8958, -117.0173],
  [35.2656, -116.0741], [35.6078, -115.3917], [36.1699, -115.1398], [36.8055, -114.0672],
  [37.0965, -113.5684], [37.6775, -113.0619],
];

function startDemo() {
  if (view.watchId != null) navigator.geolocation?.clearWatch(view.watchId);
  view.watchId = null;
  view.manual = false;
  $("#locBanner").hidden = true;
  $("#demoChip").hidden = false;
  closeDialogs();
  const stepKm = 0.9;
  let seg = 0;
  let along = 0;
  view.demo = setInterval(() => {
    if (!$("#reveal").hidden || document.querySelector("dialog[open]") || !$("#onboard").hidden) return;
    const a = DEMO_ROUTE[seg];
    const b = DEMO_ROUTE[seg + 1];
    if (!b) {
      stopDemo(false);
      toast("🏁", "Demo drive complete! Check the Journal for your trip.");
      return;
    }
    const len = haversineKm(a, b);
    along += stepKm;
    if (along >= len) {
      along -= len;
      seg += 1;
      return;
    }
    const f = along / len;
    onPosition(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, bearing(a, b));
  }, 220);
  setFollowing(true);
  if (!view.pos) onPosition(DEMO_ROUTE[0][0], DEMO_ROUTE[0][1], 90);
}

function stopDemo(resumeGeo = true) {
  if (!view.demo) return;
  clearInterval(view.demo);
  view.demo = null;
  $("#demoChip").hidden = true;
  if (resumeGeo) startGeo();
}
$("#stopDemoBtn").addEventListener("click", () => stopDemo(true));

// ---------------------------------------------------------------- areas

function setPill(title, sub, loading) {
  $("#areaTitle").textContent = title;
  $("#areaSub").textContent = sub;
  $("#areaPill").classList.toggle("loading", !!loading);
}

async function enterArea(cell) {
  const prevArea = view.area;
  view.cell = cell;
  cellRect.setBounds(cell.bounds);
  if (!map.hasLayer(cellRect)) cellRect.addTo(map);
  setPill(prevArea ? "Entering new area…" : "Finding birds…", "Looking up who lives here", true);
  if (!view.birds.length) renderLookSkeleton();

  const [name, data] = await Promise.all([areaName(cell), areaBirds(cell)]);
  if (view.cell.id !== cell.id) return; // drove on while loading

  const known = store.get().areas[cell.id];
  view.area = { id: cell.id, title: name.title, subtitle: name.subtitle, region: data.region };
  view.birds = data.birds;
  view.source = data.source;
  store.update((s) => {
    s.areas[cell.id] = {
      title: name.title,
      subtitle: name.subtitle,
      first: known?.first || Date.now(),
      keys: data.birds.map((b) => b.key),
    };
  });
  setPill(name.title, name.subtitle || REGION_NAMES[data.region], false);
  renderAll();

  if (!known) showReveal(prevArea);
  else if (prevArea) toast("👋", `Welcome back to ${esc(name.title)}!`);
}

// ---------------------------------------------------------------- photos

let inflight = 0;
const photoQueue = [];
function limited(fn) {
  return new Promise((resolve) => {
    const run = async () => {
      inflight++;
      try {
        resolve(await fn());
      } finally {
        inflight--;
        photoQueue.shift()?.();
      }
    };
    if (inflight < 4) run();
    else photoQueue.push(run);
  });
}

function photoFor(b) {
  if (!b._photo) {
    b._photo = (async () => {
      if (b.photo) return { thumb: b.photo, large: b.photoLarge || b.photo, credit: b.photoCredit || "iNaturalist" };
      const w = await limited(() => wikiSummary(b.wiki));
      if (w) {
        b._wiki = w;
        if (w.thumb) return { thumb: w.thumb, large: w.image || w.thumb, credit: "Wikipedia / Wikimedia Commons" };
      }
      return null;
    })().then((p) => {
      if (p) b._thumb = p.thumb;
      return p;
    });
  }
  return b._photo;
}

function setImg(img, b, large = false) {
  img.src = sketchDataUri(b);
  img.alt = b.name;
  photoFor(b).then((p) => {
    if (!p) return;
    const url = large ? p.large : p.thumb;
    const pre = new Image();
    pre.onload = () => {
      img.style.opacity = 0;
      img.src = url;
      requestAnimationFrame(() => (img.style.opacity = 1));
    };
    pre.src = url;
  });
}

function hydrateImages(root) {
  $$("img[data-photo]", root).forEach((img) => {
    const b = birdByKey(img.dataset.photo);
    if (b) setImg(img, b, img.dataset.large === "1");
  });
}

const birdByKey = (key) => view.birds.find((b) => b.key === key);

// ---------------------------------------------------------------- sightings

function spottersHere(key) {
  if (!view.area) return [];
  return store.get().sightings.filter((x) => x.key === key && x.areaId === view.area.id);
}
const spottedHere = (key) => spottersHere(key).length > 0;

function activeMember() {
  const s = store.get();
  return crewById(s.activeId) || s.crew[0] || null;
}

function openSpot(b) {
  const s = store.get();
  if (!s.crew.length) addCrew("Spotter");
  if (store.get().crew.length === 1) {
    const me = store.get().crew[0];
    const already = spottersHere(b.key).some((x) => x.playerId === me.id);
    applySpot(b, already ? [] : [me.id]);
    return;
  }
  const current = new Set(spottersHere(b.key).map((x) => x.playerId));
  const active = activeMember();
  if (!current.size && active) current.add(active.id);
  $("#spotSub").textContent = `${b.name} · +${RARITY[b.rarity].points} point${b.rarity > 1 ? "s" : ""} each`;
  $("#crewPick").innerHTML = store
    .get()
    .crew.map(
      (c) => `<button type="button" class="crew-toggle" data-id="${esc(c.id)}" aria-pressed="${current.has(c.id)}">
        <span class="av" style="--c:${esc(c.color)}">${esc(c.avatar)}</span>${esc(c.name)}<span class="tick">✓</span></button>`
    )
    .join("");
  view.openBird = b;
  $("#spotDialog").showModal();
}

$("#crewPick").addEventListener("click", (e) => {
  const t = e.target.closest(".crew-toggle");
  if (t) t.setAttribute("aria-pressed", t.getAttribute("aria-pressed") !== "true");
});
$("#spotConfirm").addEventListener("click", () => {
  const ids = $$(".crew-toggle[aria-pressed='true']", $("#crewPick")).map((el) => el.dataset.id);
  $("#spotDialog").close();
  if (view.openBird) applySpot(view.openBird, ids);
});

function applySpot(b, playerIds) {
  const area = view.area;
  if (!area) return;
  const want = new Set(playerIds);
  const have = new Set(spottersHere(b.key).map((x) => x.playerId));
  const added = [...want].filter((id) => !have.has(id));
  const removed = [...have].filter((id) => !want.has(id));
  if (!added.length && !removed.length) return;
  const points = RARITY[b.rarity].points;
  const newRecords = added.map((playerId) => ({
    id: store.uid(),
    key: b.key,
    name: b.name,
    sci: b.sci,
    wiki: b.wiki,
    rarity: b.rarity,
    points,
    group: b.group,
    areaId: area.id,
    areaTitle: area.title,
    playerId,
    lat: view.pos?.lat ?? null,
    lng: view.pos?.lng ?? null,
    photo: b._thumb || null,
    t: Date.now(),
  }));
  const removedRecords = spottersHere(b.key).filter((x) => removed.includes(x.playerId));
  store.update((s) => {
    s.sightings = s.sightings.filter((x) => !removedRecords.includes(x));
    s.sightings.push(...newRecords);
  });
  [...added, ...removed].forEach((playerId) => markDirty(playerId, area.id));

  if (added.length) {
    const who = added.map(crewById).filter(Boolean);
    const names = who.length > 2 ? `${who.length} spotters` : who.map((c) => esc(c.name)).join(" & ");
    confetti($("#bdSpotBtn").offsetParent ? $("#bdSpotBtn") : null);
    if (store.get().settings.sound) chirp("spot");
    vibrate([20, 40, 30]);
    toast(
      who.map((c) => c.avatar).join(""),
      `${names} spotted a <b>${esc(b.name)}</b>! <b>+${points}</b>`,
      {
        label: "Undo",
        fn: () => applySpot(b, [...have]),
      }
    );
  }
  renderAll();
  if ($("#birdDialog").open) fillBird(b);
  checkBingo();
  checkBadges();
}

// ---------------------------------------------------------------- rendering

function renderAll() {
  renderHead();
  renderLook();
  renderBingo();
  renderLeaders();
  renderJournal();
  renderSightingPins();
}

function renderHead() {
  const n = view.birds.length;
  const k = view.birds.filter((b) => spottedHere(b.key)).length;
  $("#sheetTitle").textContent = n ? `${n - k} bird${n - k === 1 ? "" : "s"} to find` : "Birds around here";
  $("#sheetSub").textContent = n
    ? `${k} of ${n} spotted near ${view.area.title}`
    : "Looking up who lives nearby…";
  $("#progressNum").textContent = k;
  const frac = n ? k / n : 0;
  $("#ringFg").style.strokeDashoffset = String(119.4 * (1 - frac));
  const a = activeMember();
  $("#spotterChip").innerHTML = a
    ? `<span class="av" style="--c:${esc(a.color)}">${esc(a.avatar)}</span>${esc(a.name)}`
    : "+ Spotter";
  $("#spotterChip").title = store.get().crew.length > 1 ? "Tap to pass the phone to the next spotter" : "";
}

function renderLookSkeleton() {
  $("#birdGrid").innerHTML = Array.from({ length: 6 }, () => `<div class="skeleton"></div>`).join("");
}

function birdCard(b, i) {
  const r = RARITY[b.rarity];
  const g = GROUP_LABELS[b.group] || GROUP_LABELS.songbird;
  return `<button class="bird-card ${spottedHere(b.key) ? "spotted" : ""}" data-key="${esc(b.key)}" style="animation-delay:${Math.min(i, 12) * 35}ms">
    <div class="ph"><img data-photo="${esc(b.key)}" alt="" /><span class="gem ${r.key}">${r.label} · ${r.points}</span></div>
    <div class="info"><div class="nm">${esc(b.name)}</div>
    <div class="meta"><span title="${esc(g.label)}">${g.emoji}</span>${b.carSpot ? '<span title="Easy to see from the car">🚗</span>' : ""}<span>${esc(g.label)}</span></div></div>
  </button>`;
}

function renderLook() {
  if (!view.area) return;
  const f = view.filter;
  const list = view.birds.filter((b) => {
    if (f === "todo") return !spottedHere(b.key);
    if (f === "spotted") return spottedHere(b.key);
    if (f === "car") return b.carSpot;
    if (f === "raptor" || f === "water") return b.group === f;
    return true;
  });
  const grid = $("#birdGrid");
  if (!list.length) {
    grid.innerHTML =
      f === "todo" && view.birds.length
        ? `<div class="empty"><div class="big">🏆</div><p><b>You found every bird on the list!</b><br/>Keep driving to find new bird country.</p></div>`
        : f === "spotted"
        ? `<div class="empty"><div class="big">🔭</div><p>Nothing spotted here yet.<br/>Tap a bird, then <b>I spotted it!</b></p></div>`
        : `<div class="empty"><div class="big">🪶</div><p>No birds in this group here.</p></div>`;
  } else {
    grid.innerHTML = list.map(birdCard).join("");
    hydrateImages(grid);
  }
  $("#sourceNote").textContent =
    view.source === "live"
      ? `Based on recent iNaturalist sightings within 25 miles. Rarity is local: rare here means few sightings nearby.`
      : `Showing the ${REGION_NAMES[view.area.region]} field guide. Live local sightings load when you have signal.`;
}

$("#birdGrid").addEventListener("click", (e) => {
  const card = e.target.closest(".bird-card");
  if (card) openBird(birdByKey(card.dataset.key));
});

$("#filters").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter");
  if (!btn) return;
  view.filter = btn.dataset.filter;
  $$(".filter").forEach((b) => b.setAttribute("aria-pressed", b === btn));
  renderLook();
});

// ---------------------------------------------------------------- bird detail

function openBird(b) {
  if (!b) return;
  view.openBird = b;
  fillBird(b);
  $("#birdDialog").showModal();
  $(".bird-body", $("#birdDialog")).scrollTop = 0;
}

function firstSentence(text) {
  const m = (text || "").match(/^.*?[.!?](\s|$)/);
  return m ? m[0].trim() : text;
}

function fillBird(b) {
  if (soundFor !== b) resetSound(b);
  const r = RARITY[b.rarity];
  const g = GROUP_LABELS[b.group] || GROUP_LABELS.songbird;
  setImg($("#bdImg"), b, true);
  $("#bdRarity").className = `rarity ${r.key}`;
  $("#bdRarity").textContent = `${r.label} · ${r.points} pt${r.points > 1 ? "s" : ""}`;
  $("#bdName").textContent = b.name;
  $("#bdSci").textContent = b.sci;

  const chips = [`${g.emoji} ${g.label}`];
  if (b.carSpot) chips.push("🚗 Easy from the car");
  if (b.observations) chips.push(`👁 ${b.observations.toLocaleString()} local sightings`);
  $("#bdChips").innerHTML = chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("");

  const look = $("#bdLook");
  look.hidden = !b.lookFor;
  look.innerHTML = b.lookFor ? `<b>Where to look</b>${esc(b.lookFor)}` : "";

  const size = SIZE_LABELS[b.size];
  $("#bdSize").hidden = !size;
  if (size)
    $("#bdSize").innerHTML = `<div class="size-top"><b>📏 ${esc(size.label)}</b><div class="size-bar"><i style="width:${Math.min(100, (size.inches / 40) * 100)}%"></i></div></div><span class="muted">About ${size.inches} inches, ${esc(size.compare)}</span>`;

  const kid = $("#bdKid");
  const about = $("#bdAbout");
  const credit = $("#bdCredit");
  const setText = (w) => {
    kid.hidden = !(b.kidFact || w?.extract);
    kid.textContent = b.kidFact || firstSentence(w?.extract || "");
    about.textContent = b.about || w?.extract || "";
    const link = w?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(b.wiki || b.name)}`;
    photoFor(b).then((p) => {
      if (view.openBird !== b) return;
      credit.innerHTML = `${p ? `Photo: ${esc(p.credit)}. ` : ""}<a href="${esc(link)}" target="_blank" rel="noopener">Read more on Wikipedia →</a>`;
    });
  };
  setText(b._wiki);
  if (!b.about && !b._wiki) {
    about.textContent = "Loading description…";
    wikiSummary(b.wiki).then((w) => {
      b._wiki = w || null;
      if (view.openBird === b) {
        setText(w);
        if (!w) about.textContent = "No description available offline. Look it up when you have signal.";
      }
    });
  }

  const sp = spottersHere(b.key).map((x) => crewById(x.playerId)).filter(Boolean);
  $("#bdSpotters").innerHTML = sp.length
    ? `<span>Spotted by</span>${sp.map((c) => `<span class="av" style="--c:${esc(c.color)}" title="${esc(c.name)}">${esc(c.avatar)}</span>`).join("")}`
    : `<span class="muted">Nobody has spotted this one here yet. Be first!</span>`;

  const btn = $("#bdSpotBtn");
  const solo = store.get().crew.length <= 1;
  if (solo && sp.length) {
    btn.textContent = "✓ Spotted! Tap to undo";
    btn.classList.add("btn-done");
  } else {
    btn.textContent = sp.length ? `👀 Who else saw it? (+${r.points})` : `I spotted it! +${r.points}`;
    btn.classList.remove("btn-done");
  }
}

$("#bdSpotBtn").addEventListener("click", () => view.openBird && openSpot(view.openBird));

// ---------------------------------------------------------------- bird songs

const player = new Audio();
player.preload = "none";
let soundFor = null;

function soundUi(label, sub, { playing = false, disabled = false } = {}) {
  $("#bdSoundLabel").textContent = label;
  $("#bdSoundSub").textContent = sub;
  $("#bdSound").setAttribute("aria-pressed", playing);
  $("#bdSound").disabled = disabled;
}

function resetSound(b) {
  player.pause();
  soundFor = b;
  soundUi("Hear its call", "Listen before you look");
}

player.addEventListener("playing", () => soundUi("Playing…", $("#bdSoundSub").textContent, { playing: true }));
player.addEventListener("pause", () => soundUi("Play again", $("#bdSoundSub").textContent));
player.addEventListener("ended", () => soundUi("Play again", $("#bdSoundSub").textContent));

$("#bdSound").addEventListener("click", async () => {
  const b = view.openBird;
  if (!b) return;
  if (!player.paused) return player.pause();
  if (player.dataset.key === b.key && player.src) return player.play().catch(() => {});
  soundUi("Finding a recording…", "From birders on iNaturalist", { playing: true });
  const s = await birdSound(b);
  if (view.openBird !== b) return;
  if (!s) {
    soundUi("No recording found", navigator.onLine ? "Nobody has shared one yet" : "Try again when you have signal", { disabled: navigator.onLine });
    return;
  }
  player.src = s.url;
  player.dataset.key = b.key;
  soundUi("Loading…", `🎙 ${s.credit}`.slice(0, 80), { playing: true });
  player.play().catch(() => soundUi("Couldn't play this one", "Tap to try again"));
});
$("#birdDialog").addEventListener("close", () => player.pause());

// ---------------------------------------------------------------- trip card

let shareBlob = null;
$("#shareBtn").addEventListener("click", async () => {
  const btn = $("#shareBtn");
  btn.disabled = true;
  btn.textContent = "🎨 Painting your card…";
  try {
    const s = store.get();
    const areaTitles = Object.values(s.areas)
      .sort((a, b) => a.first - b.first)
      .map((a) => a.title);
    shareBlob = await makeShareCard({
      trail: s.trail,
      sightings: s.sightings,
      stats: tripCounts(),
      crew: standings(null).filter((c) => c.points > 0),
      areaTitles,
    });
    const img = $("#sharePreview");
    if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(shareBlob);
    $("#shareDialog").showModal();
  } catch {
    toast("😕", "Couldn't make the card this time.");
  } finally {
    btn.disabled = false;
    btn.textContent = "📸 Make our trip card";
  }
});

function saveCard() {
  if (!shareBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(shareBlob);
  a.download = `birddriving-trip-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
$("#shareSave").addEventListener("click", saveCard);
$("#shareSend").addEventListener("click", async () => {
  if (!shareBlob) return;
  const file = new File([shareBlob], "birddriving-trip.png", { type: "image/png" });
  const n = tripCounts().species;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Our BirdDriving trip", text: `We spotted ${n} bird species on our road trip! 🐦🚗` });
    } catch {
      // Share sheet dismissed.
    }
  } else {
    saveCard();
  }
});

// ---------------------------------------------------------------- reveal

function showReveal(prevArea) {
  const s = store.get();
  const prevKeys = new Set(prevArea ? s.areas[prevArea.id]?.keys || [] : []);
  const everSpotted = new Set(s.sightings.map((x) => x.key));
  const fresh = view.birds.filter((b) => !prevKeys.has(b.key));
  let pool = fresh.filter((b) => !everSpotted.has(b.key));
  if (pool.length < 3) pool = view.birds.filter((b) => !everSpotted.has(b.key));
  if (pool.length < 3) pool = view.birds;
  const score = (b, i) => (b.carSpot ? 2 : 0) + ({ 1: 0.6, 3: 1.4, 5: 1 }[b.rarity] || 0) - i * 0.02;
  const picks = pool
    .map((b, i) => [b, score(b, i)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([b]) => b);

  $("#revealEyebrow").textContent = prevArea ? "✦ New bird country ✦" : "✦ Your trip begins in ✦";
  $("#revealTitle").textContent = view.area.title;
  $("#revealSub").textContent = prevArea
    ? fresh.length
      ? `${fresh.length} bird${fresh.length === 1 ? "" : "s"} here that weren't on your list in ${prevArea.title}. Watch for these first:`
      : `Same feathered neighbors as ${prevArea.title}, but a fresh leaderboard. Watch for these:`
    : `${view.birds.length} birds live around here. Start with these three:`;
  $("#revealCards").innerHTML = picks
    .map(
      (b) => `<button class="fan-card" data-key="${esc(b.key)}" type="button">
      <div class="ph"><img data-photo="${esc(b.key)}" data-large="1" alt="" /><span class="gem ${RARITY[b.rarity].key}">${RARITY[b.rarity].label}</span></div>
      <div class="txt"><b>${esc(b.name)}</b><small>${esc(b.lookFor || b.kidFact || GROUP_LABELS[b.group]?.label || "")}</small></div></button>`
    )
    .join("");
  hydrateImages($("#revealCards"));
  $("#reveal").hidden = false;
  $("#revealGo").focus({ preventScroll: true });
  if (s.settings.sound) chirp("area");
}

function closeReveal() {
  $("#reveal").hidden = true;
}
$("#revealGo").addEventListener("click", () => {
  closeReveal();
  setSheet("half");
  selectTab("look");
});
$("#revealCards").addEventListener("click", (e) => {
  const card = e.target.closest(".fan-card");
  if (!card) return;
  closeReveal();
  openBird(birdByKey(card.dataset.key));
});
$("#areaPill").addEventListener("click", () => {
  if (view.area && view.birds.length) showReveal(null);
});

// ---------------------------------------------------------------- bingo

function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function strHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

function bingoCells() {
  if (!view.area || view.birds.length < 8) return null;
  const info = store.get().bingo[view.area.id] || { seed: 0 };
  const rnd = seededRandom(strHash(view.area.id) + info.seed * 7919);
  const shuffle = (arr) => arr.map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const tier = (r) => shuffle(view.birds.filter((b) => b.rarity === r));
  const picks = [...tier(1).slice(0, 5), ...tier(3).slice(0, 2), ...tier(5).slice(0, 1)];
  for (const b of shuffle(view.birds)) {
    if (picks.length >= 8) break;
    if (!picks.includes(b)) picks.push(b);
  }
  const cells = shuffle(picks.slice(0, 8));
  cells.splice(4, 0, null);
  return cells;
}

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function bingoState() {
  const cells = bingoCells();
  if (!cells) return null;
  const hit = cells.map((b) => !b || spottedHere(b.key));
  const lines = LINES.filter((l) => l.every((i) => hit[i]));
  return { cells, hit, lines };
}

function renderBingo() {
  const el = $("#bingo");
  const st = bingoState();
  if (!st) {
    el.innerHTML = `<p class="empty" style="grid-column:1/-1">Bingo needs at least 8 local birds. Drive on!</p>`;
    return;
  }
  const inLine = new Set(st.lines.flat());
  el.innerHTML = st.cells
    .map((b, i) =>
      b
        ? `<button type="button" class="bingo-cell ${st.hit[i] ? "hit" : ""} ${inLine.has(i) ? "line" : ""}" data-key="${esc(b.key)}" aria-label="${esc(b.name)}${st.hit[i] ? ", spotted" : ""}">
          <img data-photo="${esc(b.key)}" alt="" /><span class="lbl">${esc(b.name)}</span></button>`
        : `<div class="bingo-cell free ${inLine.has(i) ? "line" : ""}">🚗<span class="lbl">FREE</span></div>`
    )
    .join("");
  hydrateImages(el);
}

function checkBingo() {
  const st = bingoState();
  if (!st || !st.lines.length) return;
  const info = store.get().bingo[view.area.id] || { seed: 0 };
  if (info.won) return;
  store.update((s) => {
    s.bingo[view.area.id] = { ...info, won: true };
    s.bingoWins = (s.bingoWins || 0) + 1;
  });
  setTimeout(() => {
    confetti(null, ["#ffc857", "#ff7a45", "#fff"]);
    if (store.get().settings.sound) chirp("bingo");
    toast("🎉", "<b>BINGO!</b> Your car completed a line!");
    checkBadges();
  }, 700);
}

$("#bingo").addEventListener("click", (e) => {
  const c = e.target.closest(".bingo-cell[data-key]");
  if (c) openBird(birdByKey(c.dataset.key));
});
$("#newBingoBtn").addEventListener("click", () => {
  if (!view.area) return;
  store.update((s) => {
    const cur = s.bingo[view.area.id] || { seed: 0 };
    s.bingo[view.area.id] = { seed: cur.seed + 1, won: false };
  });
  renderBingo();
});

// ---------------------------------------------------------------- leaders

const MEDALS = ["🥇", "🥈", "🥉"];

function renderLeaders() {
  const scope = view.boardScope;
  const rows = standings(scope === "area" ? view.area?.id : null);
  const s = store.get();
  $("#crewBoard").innerHTML = rows.length
    ? rows
        .map(
          (r, i) => `<li class="${r.id === s.activeId ? "me" : ""}" data-id="${esc(r.id)}">
        <span class="rank">${r.points ? MEDALS[i] || i + 1 : i + 1}</span>
        <span class="av" style="--c:${esc(r.color)}">${esc(r.avatar)}</span>
        <span class="who"><b>${esc(r.name)}</b><small>${r.count} species${r.id === s.activeId ? " · spotting now" : ""}</small></span>
        <span class="pts">${r.points}<small>pts</small></span>
        ${r.id === s.activeId ? "" : `<button class="act" data-act="active" type="button" title="Hand the phone to ${esc(r.name)}" aria-label="Hand the phone to ${esc(r.name)}">📱</button>`}
        <button class="act" data-act="remove" type="button" aria-label="Remove ${esc(r.name)}">✕</button>
      </li>`
        )
        .join("")
    : `<li><span class="who"><b>No spotters yet</b><small>Add everyone in the car to start competing.</small></span></li>`;
  if (view.tab === "leaders") renderWorld();
}

async function renderWorld() {
  const areaId = view.boardScope === "area" ? view.area?.id : null;
  const data = await fetchBoard(areaId);
  const list = $("#worldBoard");
  const note = $("#worldNote");
  if (!data) {
    list.innerHTML = "";
    note.textContent = isShared()
      ? "Couldn't reach the leaderboard. It will refresh when you have signal."
      : "Your car is competing on this device. When BirdDriving runs on its server (node server.js), every traveler shares area leaderboards.";
    return;
  }
  const mine = new Set(store.get().crew.map((c) => c.id));
  note.textContent = data.entries.length ? "" : "No one has spotted birds here yet. Claim the top spot!";
  list.innerHTML = data.entries
    .map(
      (e, i) => `<li class="${mine.has(e.playerId) ? "me" : ""}"><span class="rank">${MEDALS[i] || i + 1}</span>
      <span class="av">${esc(e.avatar)}</span><span class="who"><b>${esc(e.name)}</b><small>${e.count} species</small></span>
      <span class="pts">${e.points}<small>pts</small></span></li>`
    )
    .join("");
}

$("#boardSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  view.boardScope = b.dataset.scope;
  $$("#boardSeg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
  renderLeaders();
});

$("#crewBoard").addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]");
  const li = e.target.closest("li[data-id]");
  if (!act || !li) return;
  const member = crewById(li.dataset.id);
  if (!member) return;
  if (act.dataset.act === "active") {
    store.update((s) => (s.activeId = member.id));
    toast(member.avatar, `${esc(member.name)} is spotting now!`);
  } else if (confirm(`Remove ${member.name} and their sightings from this trip?`)) {
    const areas = new Set(store.get().sightings.filter((x) => x.playerId === member.id).map((x) => x.areaId));
    removeCrew(member.id);
    areas.forEach((a) => markDirty(member.id, a));
  }
  renderAll();
});

$("#spotterChip").addEventListener("click", () => {
  const s = store.get();
  if (!s.crew.length) return openCrewDialog();
  if (s.crew.length === 1) {
    selectTab("leaders");
    setSheet("half");
    return;
  }
  const i = s.crew.findIndex((c) => c.id === s.activeId);
  const next = s.crew[(i + 1) % s.crew.length];
  store.update((st) => (st.activeId = next.id));
  toast(next.avatar, `Pass the phone to <b>${esc(next.name)}</b>!`);
  renderAll();
});

// ---------------------------------------------------------------- crew dialog

let pickedAvatar = AVATARS[0];
function renderAvatarPick(el, onPick) {
  el.innerHTML = AVATARS.map(
    (a) => `<button type="button" role="radio" aria-checked="${a === pickedAvatar}" data-a="${a}">${a}</button>`
  ).join("");
  el.onclick = (e) => {
    const b = e.target.closest("button[data-a]");
    if (!b) return;
    pickedAvatar = b.dataset.a;
    $$("button", el).forEach((x) => x.setAttribute("aria-checked", x === b));
    onPick?.();
  };
}

function openCrewDialog() {
  const used = new Set(store.get().crew.map((c) => c.avatar));
  pickedAvatar = AVATARS.find((a) => !used.has(a)) || AVATARS[0];
  renderAvatarPick($("#avatarPick"));
  $("#crewName").value = "";
  $("#crewDialog").showModal();
  $("#crewName").focus();
}
$("#addCrewBtn").addEventListener("click", openCrewDialog);
$("#crewForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const m = addCrew($("#crewName").value, pickedAvatar);
  $("#crewDialog").close();
  toast(m.avatar, `${esc(m.name)} joined the crew!`);
  renderAll();
});

// ---------------------------------------------------------------- journal & badges

const BADGES = [
  { id: "first", ico: "🪶", name: "First Feather", desc: "Spot your first bird", test: (c) => c.species >= 1 },
  { id: "five", ico: "👀", name: "Sharp Eyes", desc: "5 species", test: (c) => c.species >= 5 },
  { id: "ten", ico: "🔭", name: "Bird Nerd", desc: "10 species", test: (c) => c.species >= 10 },
  { id: "twentyfive", ico: "📖", name: "Field Guide Legend", desc: "25 species", test: (c) => c.species >= 25 },
  { id: "raptors", ico: "🦅", name: "Hawk Eye", desc: "3 birds of prey", test: (c) => c.raptor >= 3 },
  { id: "water", ico: "🌊", name: "Wader Watcher", desc: "3 water birds", test: (c) => c.water >= 3 },
  { id: "rare", ico: "💎", name: "Lucky Feather", desc: "Spot a rare bird", test: (c) => c.rare >= 1 },
  { id: "areas", ico: "🛣️", name: "Road Warrior", desc: "Spot birds in 3 areas", test: (c) => c.areas >= 3 },
  { id: "bingo", ico: "🎉", name: "Bingo Birder", desc: "Complete a bingo line", test: (c) => c.bingo >= 1 },
  { id: "crew", ico: "🚐", name: "Full Car", desc: "Everyone spots a bird", test: (c) => c.crewSize >= 2 && c.crewAll },
];

function tripCounts() {
  const s = store.get();
  const species = new Map();
  const areas = new Set();
  const players = new Set();
  for (const x of s.sightings) {
    species.set(x.key, x);
    areas.add(x.areaId);
    players.add(x.playerId);
  }
  const vals = [...species.values()];
  let km = 0;
  for (let i = 1; i < s.trail.length; i++) {
    const d = haversineKm(s.trail[i - 1], s.trail[i]);
    if (d < 50) km += d; // skip teleports (manual map taps, GPS jumps)
  }
  return {
    species: species.size,
    raptor: vals.filter((x) => x.group === "raptor").length,
    water: vals.filter((x) => x.group === "water").length,
    rare: vals.filter((x) => x.rarity === 5).length,
    areas: areas.size,
    visited: Object.keys(s.areas).length,
    bingo: s.bingoWins || 0,
    crewSize: s.crew.length,
    crewAll: s.crew.length > 0 && s.crew.every((c) => players.has(c.id)),
    points: s.sightings.reduce((a, x) => a + x.points, 0),
    miles: km * 0.621371,
  };
}

function checkBadges() {
  const c = tripCounts();
  const s = store.get();
  const seen = new Set(s.badgesSeen || []);
  const earned = BADGES.filter((b) => b.test(c) && !seen.has(b.id));
  if (!earned.length) return;
  store.update((st) => (st.badgesSeen = [...seen, ...earned.map((b) => b.id)]));
  earned.forEach((b, i) =>
    setTimeout(() => toast(b.ico, `Badge unlocked: <b>${esc(b.name)}</b>`), 1400 + i * 1200)
  );
  renderJournal();
}

function renderJournal() {
  const c = tripCounts();
  $("#stats").innerHTML = [
    [c.species, "Species"],
    [c.points, "Points"],
    [c.visited, "Areas"],
    [Math.round(c.miles), "Miles"],
  ]
    .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`)
    .join("");
  const seen = new Set(store.get().badgesSeen || []);
  $("#badges").innerHTML = BADGES.map((b) => {
    const got = seen.has(b.id) || b.test(c);
    return `<div class="badge ${got ? "" : "locked"}"><span class="ico">${b.ico}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`;
  }).join("");

  const s = store.get();
  const byArea = new Map();
  for (const x of [...s.sightings].sort((a, b) => b.t - a.t)) {
    if (!byArea.has(x.areaId)) byArea.set(x.areaId, new Map());
    const m = byArea.get(x.areaId);
    if (!m.has(x.key)) m.set(x.key, { ...x, who: [] });
    m.get(x.key).who.push(crewById(x.playerId));
  }
  $("#log").innerHTML = byArea.size
    ? [...byArea.entries()]
        .map(
          ([areaId, m]) => `<div class="log-area">📍 ${esc(s.areas[areaId]?.title || [...m.values()][0].areaTitle)}</div>` +
            [...m.values()]
              .map(
                (x) => `<div class="log-item"><img src="${esc(x.photo || sketchDataUri(x))}" alt="" loading="lazy" />
            <div class="who"><b>${esc(x.name)}</b><small>${new Date(x.t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} · +${x.points}</small></div>
            <span>${x.who.filter(Boolean).map((w) => esc(w.avatar)).join("")}</span></div>`
              )
              .join("")
        )
        .join("")
    : `<div class="empty"><div class="big">🗺️</div><p>Your trip log fills up as you spot birds.</p></div>`;
}

function renderSightingPins() {
  sightingLayer.clearLayers();
  const seen = new Set();
  for (const x of store.get().sightings) {
    const k = `${x.areaId}|${x.key}`;
    if (seen.has(k) || x.lat == null) continue;
    seen.add(k);
    const img = x.photo || sketchDataUri(x);
    L.marker([x.lat, x.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="pin-bird ${x.rarity === 5 ? "rare" : ""}" style="background-image:url('${esc(img)}')"></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
      title: x.name,
    })
      .bindPopup(`<b>${esc(x.name)}</b><br/>${esc(x.areaTitle)}`)
      .addTo(sightingLayer);
  }
}

// ---------------------------------------------------------------- sheet, tabs, dialogs

function setSheet(state) {
  $("#sheet").dataset.state = state;
  if (view.following && view.pos) setTimeout(() => centerOn(view.pos.lat, view.pos.lng), 400);
}

function selectTab(tab) {
  view.tab = tab;
  $$(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === tab));
  $$(".panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  if (tab === "leaders") renderWorld();
  $(".panels").scrollTop = 0;
}

$(".tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  selectTab(t.dataset.tab);
  if ($("#sheet").dataset.state === "peek") setSheet("half");
});

const SHEET_ORDER = ["peek", "half", "full"];
$("#sheetHandle").addEventListener("click", () => {
  const i = SHEET_ORDER.indexOf($("#sheet").dataset.state);
  setSheet(SHEET_ORDER[(i + 1) % SHEET_ORDER.length]);
});

// Swipe the sheet by its handle or header.
(() => {
  let startY = null;
  const onDown = (e) => {
    if (e.target.closest("button:not(.sheet-handle)")) return;
    startY = e.clientY;
  };
  const onUp = (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    startY = null;
    if (Math.abs(dy) < 30) return;
    const i = SHEET_ORDER.indexOf($("#sheet").dataset.state);
    setSheet(SHEET_ORDER[Math.max(0, Math.min(2, i + (dy < 0 ? 1 : -1)))]);
  };
  for (const el of [$("#sheetHandle"), $(".sheet-head")]) {
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
  }
})();

document.addEventListener("click", (e) => {
  const closer = e.target.closest("[data-close]");
  if (closer) closer.closest("dialog")?.close();
});
$$("dialog").forEach((d) =>
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  })
);
function closeDialogs() {
  $$("dialog[open]").forEach((d) => d.close());
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#reveal").hidden) closeReveal();
});

// ---------------------------------------------------------------- toasts

function toast(icon, html, action, ms = 3800) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span class="t-ico">${esc(icon)}</span><span>${html}</span>`;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action.label;
    b.onclick = () => {
      action.fn();
      dismiss();
    };
    el.appendChild(b);
  }
  const host = $("#toasts");
  host.appendChild(el);
  while (host.children.length > 2) host.firstElementChild.remove();
  const dismiss = () => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  };
  setTimeout(dismiss, ms);
}

// ---------------------------------------------------------------- settings

function applySettings() {
  const st = store.get().settings;
  document.body.classList.toggle("kid", !!st.kid);
  $("#setKid").checked = !!st.kid;
  $("#setSound").checked = !!st.sound;
}
$("#settingsBtn").addEventListener("click", () => {
  applySettings();
  $("#settingsDialog").showModal();
});
$("#setKid").addEventListener("change", (e) => {
  store.update((s) => (s.settings.kid = e.target.checked));
  applySettings();
});
$("#setSound").addEventListener("change", (e) => {
  store.update((s) => (s.settings.sound = e.target.checked));
  if (e.target.checked) chirp("spot");
});
$("#setDemo").addEventListener("click", () => {
  $("#settingsDialog").close();
  startDemo();
});
$("#setReset").addEventListener("click", () => {
  if (!confirm("Start a new trip? This clears your crew, sightings and badges on this device.")) return;
  store.reset();
  try {
    localStorage.removeItem("bd:dirty");
  } catch {
    // ignore
  }
  location.reload();
});

// ---------------------------------------------------------------- onboarding

function showOnboarding() {
  const ob = $("#onboard");
  ob.hidden = false;
  const steps = $$(".ob-step", ob);
  const go = (n) => steps.forEach((s) => (s.hidden = s.dataset.step !== String(n)));
  go(0);

  const art = ["american-robin", "red-tailed-hawk", "eastern-bluebird"].map((id) => {
    const b = { key: id, name: id, ...findGuide(id) };
    return b;
  });
  $("#obArt").innerHTML = art.map((b) => `<img alt="" data-k="${esc(b.key)}" />`).join("");
  $$("#obArt img").forEach((img, i) => setImg(img, art[i]));

  const renderCrew = () => {
    $("#obCrew").innerHTML = store
      .get()
      .crew.map(
        (c) => `<button type="button" class="ob-person" data-id="${esc(c.id)}" title="Tap to remove">
        <span class="av" style="--c:${esc(c.color)}">${esc(c.avatar)}</span>${esc(c.name)} ✕</button>`
      )
      .join("");
  };
  renderCrew();

  $("[data-next]", ob).onclick = () => {
    go(1);
    $("#obName").focus();
  };
  $("#obCrewForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("#obName").value.trim();
    if (!name) return;
    addCrew(name);
    $("#obName").value = "";
    renderCrew();
    $("#obName").focus();
  };
  $("#obCrew").onclick = (e) => {
    const p = e.target.closest(".ob-person");
    if (p) {
      removeCrew(p.dataset.id);
      renderCrew();
    }
  };
  $("#obCrewNext").onclick = () => {
    const pending = $("#obName").value.trim();
    if (pending) addCrew(pending);
    if (!store.get().crew.length) addCrew("Spotter");
    go(2);
  };
  const finish = (demo) => {
    store.update((s) => (s.onboarded = true));
    ob.hidden = true;
    renderAll();
    if (demo) startDemo();
    else startGeo();
  };
  $("#obLocate").onclick = () => finish(false);
  $("#obDemo").onclick = () => finish(true);
}

function findGuide(id) {
  const b = BIRDS.find((x) => x.id === id);
  return b ? { name: b.name, wiki: b.wiki, colors: b.colors, group: b.group, size: b.size } : {};
}

// ---------------------------------------------------------------- boot

function boot() {
  applySettings();
  const s = store.get();
  trailLine.setLatLngs(s.trail);
  renderHead();
  renderJournal();
  renderSightingPins();
  selectTab("look");
  setFollowing(true);
  if (!s.onboarded) showOnboarding();
  else startGeo();
  detectServer().then(() => {
    flush();
    renderWorld();
  });
  setInterval(() => view.tab === "leaders" && renderWorld(), 30000);
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

boot();
