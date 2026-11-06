// Tellwell — app controller: library, import & review, player, settings.
import { db, storageInfo, askPersist } from "./db.js";
import { health, getSettings, saveSettings, synth, listVoices } from "./api.js";
import { PROVIDERS, STYLES, QUALITY, SAMPLE, estimate, fmtDuration, voiceName } from "./voices.js";
import { chunkChapter } from "./chunker.js";
import { prepareChunk } from "./audio.js";
import { Generator } from "./generator.js";
import { Player } from "./player.js";

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const view = $("#view");
const sheet = $("#sheet");

const I = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/></svg>',
  spin: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4.2 3.8v3.6h3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><text x="12.3" y="15.3" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" font-family="system-ui,sans-serif">15</text></svg>',
  fwd: '<svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19.8 3.8v3.6h-3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><text x="11.7" y="15.3" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" font-family="system-ui,sans-serif">30</text></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5.5v13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 6.2v11.6a.7.7 0 0 1-1.1.6L9 12.6a.7.7 0 0 1 0-1.2l8.4-5.8a.7.7 0 0 1 1.1.6z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M18 5.5v13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5.5 6.2v11.6a.7.7 0 0 0 1.1.6l8.4-5.8a.7.7 0 0 0 0-1.2L6.6 5.6a.7.7 0 0 0-1.1.6z" fill="currentColor"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6.5h11M9 12h11M9 17.5h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4.8" cy="6.5" r="1.2" fill="currentColor"/><circle cx="4.8" cy="12" r="1.2" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1.2" fill="currentColor"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M5 6h14M5 10h14M5 14h14M5 18h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="15" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  upload: '<svg viewBox="0 0 40 40"><path d="M20 26V8M13 15l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 25v5a3 3 0 0 0 3 3h20a3 3 0 0 0 3-3v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

function toast(msg, ms = 3200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), ms);
}

function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Generated cover art (also used on the lock screen).
const covers = new Map();
function coverFor(book) {
  const key = `${book.id}|${book.title}|${book.author}`;
  if (covers.has(key)) return covers.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const hue = hash(book.title) % 360;
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, `hsl(${hue} 38% 26%)`);
  grad.addColorStop(1, `hsl(${(hue + 30) % 360} 42% 11%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(240, 214, 170, 0.55)";
  g.lineWidth = 2;
  g.strokeRect(30, 30, 452, 452);
  g.lineWidth = 1;
  g.strokeRect(38, 38, 436, 436);
  const serif = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
  const words = book.title.split(/\s+/);
  let size = 66;
  let lines;
  for (; size > 26; size -= 4) {
    g.font = `600 ${size}px ${serif}`;
    lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (g.measureText(test).width > 380 && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
    if (lines.length <= 5 && lines.every((l) => g.measureText(l).width <= 400)) break;
  }
  g.fillStyle = "#f6ecd8";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const lh = size * 1.12;
  const top = 230 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => g.fillText(l, 256, top + i * lh));
  const by = top + lines.length * lh + 18;
  g.fillStyle = "rgba(240, 214, 170, 0.8)";
  g.fillRect(226, by, 60, 1.5);
  if (book.author) {
    g.font = `500 22px ${serif}`;
    g.fillStyle = "rgba(246, 236, 216, 0.85)";
    if ("letterSpacing" in g) g.letterSpacing = "3px";
    g.fillText(book.author.toUpperCase(), 256, by + 36, 420);
  }
  const url = c.toDataURL("image/png");
  covers.set(key, url);
  return url;
}

// ---------- state ----------
const gen = new Generator();
const player = new Player(gen);
let server = { providers: {}, passcode: false, mock: false };
let importState = null;
const settings0 = getSettings();
player.rate = settings0.rate || 1;

const hasKey = (p) => Boolean(server.mock || server.providers?.[p] || getSettings().keys?.[p]);
const customVoices = (p) => {
  try {
    return JSON.parse(localStorage.getItem(`tellwell.voices.${p}`) || "[]");
  } catch {
    return [];
  }
};

// ---------- routing ----------
function route() {
  const h = location.hash || "#/";
  const m = h.match(/^#\/book\/([\w-]+)/);
  sheetClose();
  if (m) return renderPlayer(m[1]);
  if (h.startsWith("#/import") && importState) return renderReview();
  return renderLibrary();
}
window.addEventListener("hashchange", route);
const go = (h) => (location.hash === h ? route() : (location.hash = h));

// ---------- library ----------
async function renderLibrary() {
  document.title = "Tellwell";
  const books = (await db.allBooks()).sort((a, b) => (b.openedAt || b.createdAt) - (a.openedAt || a.createdAt));
  const rows = await Promise.all(
    books.map(async (b) => {
      const [p, idx] = await Promise.all([db.getProgress(b.id), b.id === gen.book?.id ? gen.done : db.audioIndex(b.id)]);
      return { b, p, ready: idx.size };
    })
  );
  const empty = !books.length;
  view.innerHTML = `
    ${empty ? `<section class="hero"><h1>Any book, read aloud beautifully.</h1>
      <p>Upload a PDF. Tellwell finds the chapters, cleans up the page clutter, and has a natural narrator voice read it, passage by passage, so it flows like a real audiobook. Listen right here.</p></section>` : ""}
    <div class="drop" id="drop">
      ${I.upload}
      <div><b>${empty ? "Drop a PDF here" : "Add another book"}</b></div>
      <div class="muted small">Text-based PDFs work best. Scanned pages need OCR first.</div>
      <button class="btn primary" id="pick">Choose a PDF</button>
    </div>
    ${
      empty
        ? `<div class="steps">
      <div class="step"><b>1 · Upload</b><span>Chapters are detected from the PDF's bookmarks or headings. Headers, page numbers and footnotes are removed.</span></div>
      <div class="step"><b>2 · Pick a voice</b><span>Audition narrators chosen for long-form reading, and set the narration style for the genre.</span></div>
      <div class="step"><b>3 · Listen</b><span>Start within seconds while the rest is narrated. Your place, speed and sleep timer are remembered.</span></div>
    </div>`
        : `<div class="shelf-head"><h2>Your library</h2><span class="muted small">${books.length} book${books.length > 1 ? "s" : ""}</span></div>
    <div class="shelf">${rows.map(bookCard).join("")}</div>`
    }`;
  $("#pick").onclick = () => $("#fileInput").click();
  wireDrop($("#drop"));
  $$(".book").forEach((el) => (el.onclick = (e) => (e.target.closest(".book-menu") ? bookMenu(el.dataset.id) : go(`#/book/${el.dataset.id}`))));
  renderMini();
}

function bookProgress(b, p) {
  if (!p) return 0;
  let before = 0;
  let total = 0;
  b.chapters.forEach((c, ci) =>
    c.chunks.forEach((k, ki) => {
      total += k.text.length;
      if (ci < p.ch || (ci === p.ch && ki < p.k)) before += k.text.length;
    })
  );
  return total ? before / total : 0;
}

function bookCard({ b, p, ready }) {
  const total = b.chapters.reduce((s, c) => s + c.chunks.length, 0);
  const listened = bookProgress(b, p);
  const narrating = ready < total;
  const left = (b.words * (1 - listened)) / 155;
  const status = narrating ? `Narrated ${Math.round((ready / total) * 100)}%` : listened > 0.995 ? "Finished" : listened > 0 ? `${fmtDuration(left)} left` : fmtDuration(b.words / 155);
  return `<button class="book" data-id="${b.id}">
    <img src="${coverFor(b)}" alt="" />
    <span class="book-menu" role="button" aria-label="Book options">${I.more}</span>
    <div class="t">${esc(b.title)}</div>
    <div class="s">${esc(status)}</div>
    <div class="bar"><i style="width:${(listened * 100).toFixed(1)}%"></i></div>
  </button>`;
}

function wireDrop(el) {
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    el.classList.add("over");
  });
  el.addEventListener("dragleave", () => el.classList.remove("over"));
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("over");
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  });
}
$("#fileInput").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (f) handleFile(f);
});

function bookMenu(id) {
  sheetOpen(
    "Book",
    `<div class="menu"><button data-a="open">Open</button><button data-a="delete" class="danger">Delete book and its audio</button></div>`,
    (body) => {
      body.onclick = async (e) => {
        const a = e.target.closest("button")?.dataset.a;
        if (a === "open") go(`#/book/${id}`);
        if (a === "delete") {
          if (!confirm("Delete this audiobook from this device?")) return;
          if (player.book?.id === id) {
            player.pause();
            player.book = null;
            gen.stop();
            gen.book = null;
          }
          await db.deleteBook(id);
          sheetClose();
          renderLibrary();
        }
      };
    }
  );
}

// ---------- import ----------
async function handleFile(file) {
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return toast("That isn't a PDF.");
  importState = null;
  location.hash = "#/import";
  view.innerHTML = `<div class="importing"><h2>Reading “${esc(file.name)}”</h2><div class="bar"><i id="ip" style="width:2%"></i></div><div class="muted small" id="ipt">Opening the PDF…</div></div>`;
  try {
    const { extractPdf } = await import("./pdf-extract.js");
    const buf = await file.arrayBuffer();
    const parsed = await extractPdf(buf, file.name, (f) => {
      const bar = $("#ip");
      if (bar) bar.style.width = `${Math.max(2, f * 100)}%`;
      const t = $("#ipt");
      if (t) t.textContent = `Finding chapters and cleaning up the text… ${Math.round(f * 100)}%`;
    });
    const last = JSON.parse(localStorage.getItem("tellwell.lastChoice") || "{}");
    let provider = last.provider && PROVIDERS[last.provider] ? last.provider : "elevenlabs";
    if (!hasKey(provider) && hasKey("openai")) provider = "openai";
    importState = {
      ...parsed,
      provider,
      voice: last.provider === provider && last.voice ? last.voice : PROVIDERS[provider].voices[0].id,
      model: last.provider === provider && last.model ? last.model : PROVIDERS[provider].models[0].id,
      style: last.style || "literary",
      quality: last.quality || "mp3_44100_64",
      mode: last.mode || "all",
      open: new Set(),
    };
    renderReview();
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="importing"><h2>Couldn't read that PDF</h2><p class="muted">${esc(e.message || "Unknown error")}</p><a class="btn" href="#/">Back to library</a></div>`;
  }
}

function chapterText(c, limit = 1400) {
  let out = "";
  for (const p of c.paragraphs) {
    if (p.kind === "break") out += "\n\n* * *";
    else out += (out ? "\n\n" : "") + p.text;
    if (out.length > limit) return out.slice(0, limit) + "…";
  }
  return out || "(no text)";
}

function renderReview() {
  const s = importState;
  if (!s) return go("#/");
  document.title = `${s.title} · Tellwell`;
  const P = PROVIDERS[s.provider];
  const voices = [...P.voices, ...(s.provider === "elevenlabs" ? customVoices("elevenlabs").filter((v) => !P.voices.some((x) => x.id === v.id)) : [])];
  if (!voices.some((v) => v.id === s.voice)) s.voice = voices[0].id;
  if (!P.models.some((m) => m.id === s.model)) s.model = P.models[0].id;
  const scroll = window.scrollY;

  view.innerHTML = `
  <div class="review">
    <div>
      <section class="panel">
        <h2>Your book</h2>
        <p class="muted">Check the title and chapters. Untick anything you don't want read aloud, like the contents page or notes.</p>
        <div class="two">
          <div class="field"><label for="ti">Title</label><input class="input" id="ti" value="${esc(s.title)}" /></div>
          <div class="field"><label for="au">Author</label><input class="input" id="au" value="${esc(s.author)}" placeholder="Optional" /></div>
        </div>
        <div class="field"><label>Chapters (${s.chapters.length} found)</label></div>
        <div class="chapters" id="chs">${s.chapters.map((c, i) => chapterRow(c, i)).join("")}</div>
        <div class="chap-tools"><button class="link-btn" data-all="1">Include all</button><button class="link-btn" data-all="0">Include none</button></div>
      </section>
    </div>
    <div class="col-right">
      <section class="panel">
        <h2>Narrator</h2>
        <div class="seg" role="group" aria-label="Voice provider">
          ${Object.entries(PROVIDERS).map(([id, p]) => `<button data-prov="${id}" aria-pressed="${id === s.provider}">${p.name}</button>`).join("")}
        </div>
        <p class="provider-note">${esc(P.blurb)}</p>
        ${hasKey(s.provider) ? "" : keyBox(s.provider)}
        <div class="voices" id="voices">${voices.map((v) => voiceCard(v, s)).join("")}</div>
        ${s.provider === "elevenlabs" ? `<p class="tiny faint" style="margin:10px 0 0">Previews use about 250 characters. ${hasKey("elevenlabs") ? `<button class="link-btn tiny" id="loadVoices">Add voices from my ElevenLabs account</button>` : ""}</p>` : `<p class="tiny faint" style="margin:10px 0 0">Previews cost a fraction of a cent.</p>`}
      </section>
      <section class="panel">
        <h2>Narration style</h2>
        <p class="muted">Sets the delivery for the whole book.</p>
        <div class="chips" id="styles">${STYLES.map((st) => `<button class="chip" data-style="${st.id}" aria-pressed="${st.id === s.style}">${st.name}<small>${st.note}</small></button>`).join("")}</div>
        <details class="adv" style="margin-top:12px"><summary>Model and audio quality</summary>
          <div class="field"><label for="model">Model</label><select class="input" id="model">${P.models.map((m) => `<option value="${m.id}" ${m.id === s.model ? "selected" : ""}>${m.name}: ${m.note}</option>`).join("")}</select></div>
          ${s.provider === "elevenlabs" ? `<div class="field"><label for="quality">Audio quality</label><select class="input" id="quality">${QUALITY.map((q) => `<option value="${q.id}" ${q.id === s.quality ? "selected" : ""}>${q.name}: ${q.note}</option>`).join("")}</select></div>` : ""}
        </details>
      </section>
      <section class="panel">
        <h2>When to narrate</h2>
        <label class="radio"><input type="radio" name="mode" value="all" ${s.mode === "all" ? "checked" : ""}/><div><b>The whole book, now</b><span>Narrates in the background while Tellwell is open. Start listening as soon as the first passage is ready.</span></div></label>
        <label class="radio"><input type="radio" name="mode" value="ahead" ${s.mode === "ahead" ? "checked" : ""}/><div><b>As I listen</b><span>Only narrates a couple of chapters ahead of you. Saves credits if you might not finish.</span></div></label>
        <div class="summary" id="sum"></div>
        <button class="btn primary create" id="create">Create audiobook</button>
      </section>
    </div>
  </div>`;
  window.scrollTo(0, scroll);
  updateSummary();

  $("#ti").oninput = (e) => (s.title = e.target.value);
  $("#au").oninput = (e) => (s.author = e.target.value);
  $("#chs").addEventListener("change", (e) => {
    const i = +e.target.closest(".chap")?.dataset.i;
    if (e.target.type === "checkbox") {
      s.chapters[i].include = e.target.checked;
      e.target.closest(".chap").classList.toggle("off", !e.target.checked);
      updateSummary();
    }
  });
  $("#chs").addEventListener("input", (e) => {
    if (e.target.classList.contains("name")) s.chapters[+e.target.closest(".chap").dataset.i].title = e.target.value;
  });
  $("#chs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const i = +b.closest(".chap").dataset.i;
    if (b.dataset.act === "peek") {
      s.open.has(i) ? s.open.delete(i) : s.open.add(i);
      renderReview();
    } else if (b.dataset.act === "merge" && i > 0) {
      const a = s.chapters[i - 1];
      const c = s.chapters[i];
      a.paragraphs = [...a.paragraphs, { kind: "h", text: c.title }, ...c.paragraphs];
      a.words += c.words;
      a.chars += c.chars;
      a.include = a.include || c.include;
      s.chapters.splice(i, 1);
      s.open = new Set();
      renderReview();
    }
  });
  $$("[data-all]").forEach((b) => (b.onclick = () => (s.chapters.forEach((c) => (c.include = b.dataset.all === "1" && c.words > 0)), renderReview())));
  $$("[data-prov]").forEach(
    (b) =>
      (b.onclick = () => {
        if (s.provider === b.dataset.prov) return;
        s.provider = b.dataset.prov;
        s.voice = PROVIDERS[s.provider].voices[0].id;
        s.model = PROVIDERS[s.provider].models[0].id;
        renderReview();
      })
  );
  $("#voices").onclick = (e) => {
    const card = e.target.closest(".voice");
    if (!card) return;
    if (e.target.closest(".play")) return previewVoice(card.dataset.id, e.target.closest(".play"));
    s.voice = card.dataset.id;
    $$(".voice").forEach((v) => v.setAttribute("aria-pressed", v.dataset.id === s.voice));
  };
  $("#styles").onclick = (e) => {
    const b = e.target.closest("[data-style]");
    if (!b) return;
    s.style = b.dataset.style;
    $$("#styles .chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.style === s.style));
  };
  $("#model").onchange = (e) => ((s.model = e.target.value), updateSummary());
  $("#quality") && ($("#quality").onchange = (e) => (s.quality = e.target.value));
  $$('input[name="mode"]').forEach((r) => (r.onchange = () => (s.mode = r.value)));
  $("#loadVoices") && ($("#loadVoices").onclick = loadAccountVoices);
  wireKeyBox(view, renderReview);
  $("#create").onclick = createBook;
}

function chapterRow(c, i) {
  const s = importState;
  return `<div class="chap ${c.include ? "" : "off"}" data-i="${i}">
    <input type="checkbox" ${c.include ? "checked" : ""} aria-label="Include ${esc(c.title)}" />
    <div><input class="name" value="${esc(c.title)}" aria-label="Chapter title" /><div class="meta">${c.words.toLocaleString()} words · ${fmtDuration(c.words / 155)}${c.front ? " · before the first chapter" : ""}</div></div>
    <div class="acts"><button data-act="peek">${s.open.has(i) ? "Hide" : "Text"}</button>${i > 0 ? `<button data-act="merge" title="Merge into the previous chapter">Merge ↑</button>` : ""}</div>
    ${s.open.has(i) ? `<div class="preview">${esc(chapterText(c))}</div>` : ""}
  </div>`;
}

function voiceCard(v, s) {
  return `<button class="voice" data-id="${esc(v.id)}" aria-pressed="${v.id === s.voice}">
    <b>${esc(v.name)}</b><span>${esc(v.tag || v.description || v.category || "")}</span>${v.best ? `<em>${esc(v.best)}</em>` : ""}
    <span class="play" role="button" aria-label="Preview ${esc(v.name)}">${I.play}</span>
  </button>`;
}

function keyBox(provider) {
  const P = PROVIDERS[provider];
  return `<div class="keybox" data-keybox="${provider}">
    <div><b>Add your ${P.name} API key to use these voices.</b><br/><span class="muted">Find it at ${esc(P.keyHint)}. It's saved on this device only.</span></div>
    <div class="row"><input class="input" type="password" autocomplete="off" placeholder="${P.name} API key" /><button class="btn primary">Save</button></div>
  </div>`;
}
function wireKeyBox(root, after) {
  $$("[data-keybox]", root).forEach((box) => {
    const btn = $("button", box);
    btn.onclick = () => {
      const v = $("input", box).value.trim();
      if (!v) return;
      const s = getSettings();
      saveSettings({ keys: { ...s.keys, [box.dataset.keybox]: v } });
      toast("Key saved on this device.");
      after?.();
    };
  });
}

function updateSummary() {
  const s = importState;
  const inc = s.chapters.filter((c) => c.include);
  const words = inc.reduce((a, c) => a + c.words, 0);
  const chars = inc.reduce((a, c) => a + c.chars, 0);
  const est = estimate(chars, words, s.provider, s.model);
  $("#sum").innerHTML = inc.length
    ? `<div class="big">≈ ${fmtDuration(est.minutes)} of listening</div><div class="muted small">${inc.length} chapter${inc.length > 1 ? "s" : ""} · ${words.toLocaleString()} words · ${chars.toLocaleString()} characters</div><div class="muted small">${esc(est.cost)} for the whole book</div>`
    : `<div class="muted">Choose at least one chapter.</div>`;
  $("#create").disabled = !inc.length;
}

// Voice previews are cached so auditioning again is free.
const previewAudio = new Audio();
async function previewVoice(voiceId, btn) {
  const s = importState;
  const custom = customVoices(s.provider).find((v) => v.id === voiceId);
  player.pause();
  if (!previewAudio.paused && previewAudio.dataset.id === voiceId) {
    previewAudio.pause();
    btn.innerHTML = I.play;
    return;
  }
  $$(".voice .play").forEach((b) => (b.innerHTML = I.play));
  previewAudio.pause();
  const key = `${s.provider}|${voiceId}|${s.style}|${s.model}`;
  let src = null;
  try {
    const cached = await db.getPreview(key);
    if (cached) src = URL.createObjectURL(cached);
    else if (!hasKey(s.provider) && custom?.previewUrl) src = custom.previewUrl;
    else {
      if (!hasKey(s.provider)) return toast(`Add your ${PROVIDERS[s.provider].name} key first.`);
      btn.classList.add("busy");
      const style = STYLES.find((x) => x.id === s.style);
      const out = await synth({ provider: s.provider, voice: voiceId, model: s.model, text: SAMPLE, instructions: style.direction, stability: style.stability, styleExaggeration: style.exaggeration, format: "mp3_44100_64" });
      const prepared = await prepareChunk(out.data, out.type, 0);
      await db.putPreview(key, prepared.blob);
      src = URL.createObjectURL(prepared.blob);
    }
    previewAudio.src = src;
    previewAudio.dataset.id = voiceId;
    btn.innerHTML = I.pause;
    previewAudio.onended = () => (btn.innerHTML = I.play);
    await previewAudio.play();
  } catch (e) {
    toast(e.message || "Preview failed.");
    btn.innerHTML = I.play;
  } finally {
    btn.classList.remove("busy");
  }
}

async function loadAccountVoices() {
  try {
    toast("Loading your voices…");
    const voices = await listVoices("elevenlabs");
    const list = voices.map((v) => ({ id: v.id, name: v.name, tag: [v.labels?.accent, v.labels?.description || v.labels?.descriptive, v.labels?.use_case || v.labels?.use_case].filter(Boolean).join(" · ") || v.category, previewUrl: v.previewUrl }));
    localStorage.setItem("tellwell.voices.elevenlabs", JSON.stringify(list));
    toast(`Added ${list.length} voices from your account.`);
    if (importState) renderReview();
  } catch (e) {
    toast(e.message);
  }
}

async function createBook() {
  const s = importState;
  const inc = s.chapters.filter((c) => c.include);
  if (!inc.length) return;
  if (!hasKey(s.provider)) return toast(`Add your ${PROVIDERS[s.provider].name} API key first.`);
  const maxChars = PROVIDERS[s.provider].chunkChars;
  const book = {
    id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: s.title.trim() || "Untitled",
    author: s.author.trim(),
    provider: s.provider,
    voice: s.voice,
    voiceName: voiceName(s.provider, s.voice, customVoices(s.provider)),
    model: s.model,
    style: s.style,
    quality: s.quality,
    mode: s.mode,
    createdAt: Date.now(),
    words: inc.reduce((a, c) => a + c.words, 0),
    chapters: inc.map((c) => ({ title: c.title.trim() || "Untitled chapter", words: c.words, chunks: chunkChapter(c, maxChars) })),
  };
  localStorage.setItem("tellwell.lastChoice", JSON.stringify({ provider: s.provider, voice: s.voice, model: s.model, style: s.style, quality: s.quality, mode: s.mode }));
  await db.putBook(book);
  askPersist();
  importState = null;
  go(`#/book/${book.id}`);
}

// ---------- player ----------
async function openBook(id) {
  if (player.book?.id === id) return player.book;
  const book = await db.getBook(id);
  if (!book) return null;
  book.openedAt = Date.now();
  db.putBook(book);
  await gen.load(book);
  gen.paused = Boolean(book.genPaused);
  await player.load(book, coverFor(book));
  return book;
}

async function renderPlayer(id) {
  const book = await openBook(id);
  if (!book) {
    toast("That book isn't on this device.");
    return go("#/");
  }
  document.title = `${book.title} · Tellwell`;
  const showText = localStorage.getItem("tellwell.readalong") === "1";
  view.innerHTML = `
  <div class="player">
    <div class="back"><a class="icon-btn" href="#/" aria-label="Library">${I.chevron}</a><span class="tiny faint">${esc(book.voiceName)} · ${esc(STYLES.find((x) => x.id === book.style)?.name || "")}</span><button class="icon-btn" id="pmore" aria-label="More">${I.more}</button></div>
    <img class="cover" src="${coverFor(book)}" alt="" />
    <h1>${esc(book.title)}</h1>
    <div class="chapter-title" id="ptitle"></div>
    <div class="scrub" id="scrub" role="slider" tabindex="0" aria-label="Position in chapter"><div class="track"><div class="ready" id="sready"></div><div class="done" id="sdone"></div></div><div class="knob" id="sknob"></div></div>
    <div class="times"><span id="tcur">0:00</span><span id="tleft"></span></div>
    <div class="controls">
      <button class="icon-btn" id="bprev" aria-label="Previous chapter">${I.prev}</button>
      <button class="icon-btn" id="bback" aria-label="Back 15 seconds">${I.back}</button>
      <button class="main" id="bplay" aria-label="Play">${I.play}</button>
      <button class="icon-btn" id="bfwd" aria-label="Forward 30 seconds">${I.fwd}</button>
      <button class="icon-btn" id="bnext" aria-label="Next chapter">${I.next}</button>
    </div>
    <div class="waitnote" id="wait"></div>
    <div class="subcontrols">
      <button class="pill" id="bspeed"></button>
      <button class="pill" id="bsleep">${I.moon}<span>Sleep</span></button>
      <button class="pill" id="bchap">${I.list}<span>Chapters</span></button>
      <button class="pill ${showText ? "on" : ""}" id="btext">${I.text}<span>Text</span></button>
    </div>
    <div class="genbar" id="genbar"></div>
    <div class="readalong" id="read" ${showText ? "" : "hidden"}></div>
  </div>`;
  $("#bplay").onclick = () => player.toggle();
  $("#bback").onclick = () => player.skip(-15);
  $("#bfwd").onclick = () => player.skip(30);
  $("#bprev").onclick = () => (player.chapterTime() > 5 ? player.seek(0) : player.goChapter(player.ch - 1));
  $("#bnext").onclick = () => player.goChapter(player.ch + 1);
  $("#bspeed").onclick = speedSheet;
  $("#bsleep").onclick = sleepSheet;
  $("#bchap").onclick = chaptersSheet;
  $("#pmore").onclick = () => bookMenu(book.id);
  $("#btext").onclick = () => {
    const r = $("#read");
    r.hidden = !r.hidden;
    $("#btext").classList.toggle("on", !r.hidden);
    localStorage.setItem("tellwell.readalong", r.hidden ? "0" : "1");
    if (!r.hidden) renderRead();
  };
  $("#read").onclick = (e) => {
    const p = e.target.closest("p[data-k]");
    if (!p) return;
    const k = +p.dataset.k;
    if (gen.isReady(player.ch, k)) player.goChunk(player.ch, k);
  };
  wireScrub();
  updateChapter();
  updateState();
  updateTime();
  updateGen();
  renderMini();
}

function onPlayerView() {
  return Boolean($("#bplay"));
}

function updateChapter() {
  if (!onPlayerView() || !player.book) return;
  const c = player.book.chapters[player.ch];
  $("#ptitle").textContent = `${c.title} · ${player.ch + 1} of ${player.book.chapters.length}`;
  renderRead();
}

function updateState() {
  renderMini();
  if (!onPlayerView()) return;
  const b = $("#bplay");
  const wait = player.waiting && player.wantPlay;
  b.innerHTML = wait ? I.spin : player.playing ? I.pause : I.play;
  b.classList.toggle("wait", wait);
  b.setAttribute("aria-label", player.playing ? "Pause" : "Play");
  $("#wait").textContent = wait ? (gen.blocked ? "Narration is paused, see below." : "Narrating the next passage…") : "";
  $("#bspeed").innerHTML = `<span>${player.rate.toFixed(2).replace(/0$/, "").replace(/\.0$/, "")}×</span>`;
  updateSleepPill();
}

function updateSleepPill() {
  const pill = $("#bsleep");
  if (!pill) return;
  const s = player.sleep;
  pill.classList.toggle("on", Boolean(s));
  $("span", pill).textContent = !s ? "Sleep" : s.chapter ? "End of chapter" : `${Math.max(1, Math.ceil((s.until - Date.now()) / 60000))} min`;
}

let dragging = null;
function updateTime() {
  if (!onPlayerView() || !player.book) return;
  const dur = player.chapterDuration();
  const t = dragging ?? player.chapterTime();
  const ready = player.readyUntil();
  const pct = dur ? Math.min(100, (t / dur) * 100) : 0;
  $("#sdone").style.width = `${pct}%`;
  $("#sknob").style.left = `${pct}%`;
  $("#sready").style.width = `${dur ? Math.min(100, (ready / dur) * 100) : 0}%`;
  $("#tcur").textContent = fmtTime(t);
  $("#tleft").textContent = `-${fmtTime((dur - t) / player.rate)}`;
  const sc = $("#scrub");
  sc.setAttribute("aria-valuemin", "0");
  sc.setAttribute("aria-valuemax", String(Math.round(dur)));
  sc.setAttribute("aria-valuenow", String(Math.round(t)));
  sc.setAttribute("aria-valuetext", `${fmtTime(t)} of ${fmtTime(dur)}`);
  updateSleepPill();
  if (!$("#read").hidden) markRead();
}

function wireScrub() {
  const sc = $("#scrub");
  const at = (e) => {
    const r = sc.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * player.chapterDuration();
  };
  sc.addEventListener("pointerdown", (e) => {
    sc.setPointerCapture(e.pointerId);
    dragging = at(e);
    updateTime();
  });
  sc.addEventListener("pointermove", (e) => {
    if (dragging === null) return;
    dragging = at(e);
    updateTime();
  });
  const end = async (e) => {
    if (dragging === null) return;
    const t = at(e);
    dragging = null;
    if (t > player.readyUntil()) toast("That part hasn't been narrated yet.");
    await player.seek(t);
  };
  sc.addEventListener("pointerup", end);
  sc.addEventListener("pointercancel", () => ((dragging = null), updateTime()));
  sc.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") player.skip(-15);
    if (e.key === "ArrowRight") player.skip(15);
  });
}

function renderRead() {
  const r = $("#read");
  if (!r || r.hidden || !player.book) return;
  const chunks = player.book.chapters[player.ch].chunks;
  r.innerHTML = chunks.map((c, k) => `<p data-k="${k}" class="${c.kind !== "body" ? "title" : ""}">${esc(c.text)}</p>`).join("");
  r.dataset.ch = player.ch;
  r.dataset.k = "";
  markRead();
}

function markRead() {
  const r = $("#read");
  if (!r || r.hidden) return;
  if (r.dataset.ch !== String(player.ch)) return renderRead();
  $$("p[data-k]", r).forEach((p) => p.classList.toggle("pending", !gen.isReady(player.ch, +p.dataset.k)));
  if (r.dataset.k === String(player.k)) return;
  r.dataset.k = player.k;
  $$("p.now", r).forEach((p) => p.classList.remove("now"));
  const cur = $(`p[data-k="${player.k}"]`, r);
  if (cur) {
    cur.classList.add("now");
    r.scrollTo({ top: cur.offsetTop - r.clientHeight / 3, behavior: "smooth" });
  }
}

function updateGen() {
  renderMini();
  const el = $("#genbar");
  if (!el || !gen.book) return;
  const total = gen.total();
  const done = gen.done.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (gen.blocked) {
    el.className = "genbar blocked";
    el.innerHTML = `<div class="msg"><b>Narration paused</b>${esc(gen.blocked.message)}</div><div style="display:flex;gap:6px"><button class="btn ghost" id="gset">Settings</button><button class="btn primary" id="gretry">Retry</button></div>`;
    $("#gset").onclick = settingsSheet;
    $("#gretry").onclick = () => gen.start();
    return;
  }
  if (gen.complete()) {
    const secs = [...gen.done.values()].reduce((a, b) => a + b, 0);
    el.className = "genbar";
    el.innerHTML = `<div class="msg"><b>Fully narrated</b><span class="muted small">${fmtTime(secs)} total · saved on this device, plays offline</span></div>`;
    return;
  }
  const chapterNow = [...gen.book.chapters.keys()].find((ch) => gen.chapterDone(ch) < gen.book.chapters[ch].chunks.length);
  el.className = "genbar";
  if (gen.running) {
    el.innerHTML = `<div class="msg"><b>Narrating… ${pct}%</b><span class="muted small" id="gnote">${gen.book.mode === "ahead" ? "Staying a couple of chapters ahead of you" : `Working on chapter ${(chapterNow ?? 0) + 1} of ${gen.book.chapters.length}`}. Keep Tellwell open.</span></div><button class="btn ghost" id="gpause">Pause</button><div class="bar"><i style="width:${pct}%"></i></div>`;
    $("#gpause").onclick = () => {
      gen.paused = true;
      gen.book.genPaused = true;
      db.putBook(gen.book);
      gen.stop();
      updateGen();
    };
  } else {
    el.innerHTML = `<div class="msg"><b>${pct}% narrated</b><span class="muted small">${gen.book.mode === "ahead" ? "Narrates ahead as you listen." : "Narration is paused."}</span></div><button class="btn primary" id="gresume">${gen.paused ? "Resume" : "Narrate now"}</button><div class="bar"><i style="width:${pct}%"></i></div>`;
    $("#gresume").onclick = () => {
      gen.paused = false;
      gen.book.genPaused = false;
      db.putBook(gen.book);
      gen.start();
    };
  }
}

// ---------- sheets ----------
function sheetOpen(title, html, wire) {
  sheet.innerHTML = `<div class="sh-head"><h2>${esc(title)}</h2><button class="icon-btn" id="shx" aria-label="Close">${I.close}</button></div><div class="sh-body">${html}</div>`;
  $("#shx").onclick = sheetClose;
  wire?.($(".sh-body", sheet));
  if (!sheet.open) sheet.showModal();
}
function sheetClose() {
  if (sheet.open) sheet.close();
}
sheet.addEventListener("click", (e) => {
  if (e.target === sheet) sheetClose();
});

function speedSheet() {
  const rates = [0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.75, 2];
  sheetOpen("Speed", `<div class="menu">${rates.map((r) => `<button data-r="${r}" class="${r === player.rate ? "on" : ""}">${r}×${r === 1 ? " (as narrated)" : ""}</button>`).join("")}</div>`, (b) => {
    b.onclick = (e) => {
      const r = +e.target.closest("button")?.dataset.r;
      if (!r) return;
      player.setRate(r);
      saveSettings({ rate: r });
      sheetClose();
    };
  });
}

function sleepSheet() {
  const opts = [
    [0, "Off"],
    [10, "10 minutes"],
    [15, "15 minutes"],
    [30, "30 minutes"],
    [45, "45 minutes"],
    [60, "1 hour"],
    ["chapter", "End of this chapter"],
  ];
  sheetOpen("Sleep timer", `<div class="menu">${opts.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join("")}</div>`, (b) => {
    b.onclick = (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const v = btn.dataset.v === "chapter" ? "chapter" : +btn.dataset.v;
      player.setSleep(v);
      toast(v === 0 ? "Sleep timer off." : v === "chapter" ? "Stopping at the end of this chapter." : `Stopping in ${v} minutes.`);
      sheetClose();
    };
  });
}

function chapterStatus(ch) {
  const c = player.book.chapters[ch];
  const n = gen.chapterDone(ch);
  if (n >= c.chunks.length) return `<span class="st ok">✓ ${fmtTime(player.chapterDuration(ch))}</span>`;
  if (n > 0) return `<span class="st">${Math.round((n / c.chunks.length) * 100)}% narrated</span>`;
  return `<span class="st">${fmtDuration(c.words / 155)} · not yet narrated</span>`;
}

function chaptersSheet() {
  const b = player.book;
  sheetOpen(
    "Chapters",
    `<div class="chlist">${b.chapters
      .map(
        (c, i) => `<div class="chrow ${i === player.ch ? "cur" : ""}" data-i="${i}" role="button" tabindex="0">
      <div><div class="n">${esc(c.title)}</div>${chapterStatus(i)}</div><span></span><button class="more" data-more="${i}" aria-label="Chapter options">${I.more}</button></div>`
      )
      .join("")}</div>`,
    (body) => {
      const cur = $(".chrow.cur", body);
      cur?.scrollIntoView({ block: "center" });
      body.onclick = (e) => {
        const more = e.target.closest("[data-more]");
        if (more) return chapterMenu(+more.dataset.more);
        const row = e.target.closest(".chrow");
        if (!row) return;
        player.wantPlay = true;
        player.goChapter(+row.dataset.i);
        sheetClose();
      };
    }
  );
}

function chapterMenu(ch) {
  const c = player.book.chapters[ch];
  const complete = gen.chapterDone(ch) >= c.chunks.length;
  sheetOpen(
    c.title,
    `<div class="menu">
      <button data-a="play">Play from the start</button>
      ${complete ? `<button data-a="dl">Download this chapter (MP3)</button>` : ""}
      <button data-a="redo">Re-narrate this chapter</button>
    </div><p class="tiny faint">Re-narrating replaces this chapter's audio and uses credits again.</p>`,
    (body) => {
      body.onclick = async (e) => {
        const a = e.target.closest("button")?.dataset.a;
        if (a === "play") {
          player.wantPlay = true;
          player.goChapter(ch);
          sheetClose();
        }
        if (a === "dl") {
          const parts = [];
          for (let k = 0; k < c.chunks.length; k++) parts.push((await db.getAudio(player.book.id, ch, k)).blob);
          const url = URL.createObjectURL(new Blob(parts, { type: "audio/mpeg" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = `${player.book.title} - ${String(ch + 1).padStart(2, "0")} ${c.title}.mp3`.replace(/[\\/:*?"<>|]+/g, " ");
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
        if (a === "redo") {
          if (!confirm(`Re-narrate “${c.title}”? This uses credits again.`)) return;
          if (player.ch === ch) player.pause();
          gen.paused = false;
          await gen.redoChapter(ch);
          if (player.ch === ch) player.goChapter(ch);
          sheetClose();
          toast("Re-narrating…");
        }
      };
    }
  );
}

async function settingsSheet() {
  const s = getSettings();
  const st = await storageInfo();
  const mb = (n) => `${(n / 1048576).toFixed(n > 1e9 ? 0 : 1)} MB`;
  const row = (p) => `<div><span class="status-dot ${server.providers?.[p] ? "ok" : ""}"></span>${PROVIDERS[p].name}: ${server.providers?.[p] ? "key set on the server" : "no server key"}</div>`;
  sheetOpen(
    "Settings",
    `
    <div class="set-section"><h3>Voice services</h3>
      <div class="small muted" style="margin-bottom:10px">${row("elevenlabs")}${row("openai")}${server.mock ? `<div><span class="status-dot ok"></span>Test mode: voices are replaced with tones</div>` : ""}</div>
      <div class="field"><label for="k-el">Your ElevenLabs API key</label><input class="input" id="k-el" type="password" autocomplete="off" value="${esc(s.keys.elevenlabs || "")}" placeholder="Only needed if the server has none" /></div>
      <div class="field"><label for="k-oa">Your OpenAI API key</label><input class="input" id="k-oa" type="password" autocomplete="off" value="${esc(s.keys.openai || "")}" placeholder="Only needed if the server has none" /></div>
      ${server.passcode || s.passcode ? `<div class="field"><label for="k-pc">App passcode</label><input class="input" id="k-pc" type="password" value="${esc(s.passcode || "")}" /></div>` : ""}
      <p class="tiny faint">Keys are saved in this browser only and sent to your Tellwell server with each request.</p>
      <button class="btn primary" id="saveKeys">Save</button>
      ${hasKey("elevenlabs") ? `<button class="btn ghost" id="acctVoices">Add voices from my ElevenLabs account</button>` : ""}
    </div>
    <div class="set-section"><h3>Storage</h3>
      <p class="small muted">Audiobooks are stored on this device (${mb(st.usage)} used${st.quota ? ` of ${mb(st.quota)} available` : ""}). ${st.persisted ? "The browser won't clear them to free up space." : "The browser may clear them if the device runs low on space."}</p>
      ${st.persisted ? "" : `<button class="btn" id="persist">Keep my audiobooks</button>`}
    </div>
    <div class="set-section"><h3>About the voices</h3>
      <p class="small muted">Tellwell narrates with ElevenLabs or OpenAI. Block's new Dessa voice model is a research preview with no public API yet. It's a conversational speech-to-speech model rather than a narrator, and Tellwell is built so it can be added as a voice option if Block opens it up.</p>
    </div>`,
    (body) => {
      $("#saveKeys", body).onclick = async () => {
        saveSettings({ keys: { elevenlabs: $("#k-el", body).value.trim(), openai: $("#k-oa", body).value.trim() }, passcode: $("#k-pc", body)?.value.trim() ?? s.passcode });
        toast("Saved.");
        sheetClose();
        if (gen.blocked) gen.start();
        if (importState && location.hash.startsWith("#/import")) renderReview();
      };
      $("#acctVoices", body) && ($("#acctVoices", body).onclick = loadAccountVoices);
      $("#persist", body) &&
        ($("#persist", body).onclick = async () => {
          const ok = await askPersist();
          toast(ok ? "Your audiobooks will be kept." : "The browser declined. Installing Tellwell to your home screen usually helps.");
          settingsSheet();
        });
    }
  );
}

// ---------- mini player ----------
function renderMini() {
  const mini = $("#mini");
  if (!player.book || onPlayerView()) {
    mini.hidden = true;
    return;
  }
  mini.hidden = false;
  const wait = player.waiting && player.wantPlay;
  mini.innerHTML = `<img src="${coverFor(player.book)}" alt="" /><div style="min-width:0"><div class="mt">${esc(player.book.chapters[player.ch].title)}</div><div class="ms">${esc(player.book.title)}${gen.running ? ` · narrating ${Math.round((gen.done.size / gen.total()) * 100)}%` : ""}</div></div><button class="main ${wait ? "wait" : ""}" aria-label="${player.playing ? "Pause" : "Play"}">${wait ? I.spin : player.playing ? I.pause : I.play}</button>`;
  mini.onclick = (e) => (e.target.closest(".main") ? player.toggle() : go(`#/book/${player.book.id}`));
}

// ---------- events ----------
player.addEventListener("state", updateState);
player.addEventListener("time", updateTime);
player.addEventListener("chapter", () => {
  updateChapter();
  renderMini();
});
player.addEventListener("sleep", updateSleepPill);
player.addEventListener("finished", () => toast("The end. Thanks for listening."));
player.addEventListener("error", (e) => e.detail?.message && !/interrupted|aborted/i.test(e.detail.message) && toast(e.detail.message));
let libTimer = null;
gen.addEventListener("chunk", () => {
  updateGen();
  if (!onPlayerView() && !location.hash.startsWith("#/import") && !libTimer) libTimer = setTimeout(() => ((libTimer = null), $(".shelf") && renderLibrary()), 4000);
  if (onPlayerView()) markRead();
});
gen.addEventListener("state", () => {
  updateGen();
  updateState();
});
gen.addEventListener("blocked", (e) => {
  updateGen();
  updateState();
  toast(e.detail.message, 6000);
});
gen.addEventListener("retry", () => {
  const n = $("#gnote");
  if (n) n.textContent = "The voice service is busy. Retrying shortly…";
});
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select") || sheet.open || !player.book) return;
  if (e.code === "Space") {
    e.preventDefault();
    player.toggle();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && gen.running) gen.lock();
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});

// ---------- boot ----------
$("#settingsBtn").innerHTML = I.gear;
$("#settingsBtn").onclick = settingsSheet;
health().then((h) => {
  server = h;
  if (h.ok === false) toast("Can't reach the Tellwell server. Playback still works offline.");
  if (location.hash.startsWith("#/import") && importState) renderReview();
});
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
route();
