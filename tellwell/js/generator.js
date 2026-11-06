// Narration engine.
// ElevenLabs: chunks within a chapter go strictly in order, because each request
// is chained to the audio of the ones before it (request stitching); chapters
// run in parallel.
// OpenAI: each request carries its own context (the previous passage's text and
// the narration direction), so passages are narrated several at a time, always
// the ones nearest to where you're listening first.
import { db } from "./db.js";
import { synth } from "./api.js";
import { prepareChunk } from "./audio.js";
import { STYLES } from "./voices.js";

const STITCH_WINDOW_MS = 100 * 60 * 1000; // ElevenLabs keeps request ids for ~2 h
const PARALLEL_PASSAGES = 4; // OpenAI requests in flight at once
const FATAL = new Set(["auth", "no_key", "quota", "passcode", "bad_request"]);
const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

export class Generator extends EventTarget {
  constructor() {
    super();
    this.book = null;
    this.done = new Map(); // "ch|k" → duration
    this.ids = new Map(); // "ch|k" → { id, at } for stitching
    this.focus = 0;
    this.running = false;
    this.blocked = null;
    this.ctrl = null;
    this.busyChapters = new Set();
    this.concurrency = 2;
    this.wakers = [];
    this.paused = false; // user pressed Pause narration
  }

  async load(book) {
    if (this.book?.id === book.id) return;
    this.stop();
    this.book = book;
    this.done = await db.audioIndex(book.id);
    this.ids = new Map();
    this.blocked = null;
    this.focus = 0;
  }

  total() {
    return this.book ? this.book.chapters.reduce((s, c) => s + c.chunks.length, 0) : 0;
  }
  chapterDone(ch) {
    const c = this.book.chapters[ch];
    let n = 0;
    for (let k = 0; k < c.chunks.length; k++) if (this.done.has(`${ch}|${k}`)) n++;
    return n;
  }
  isReady(ch, k) {
    return this.done.has(`${ch}|${k}`);
  }
  complete() {
    return this.book && this.done.size >= this.total();
  }

  setFocus(ch) {
    this.focus = ch;
    if (this.book && !this.running && !this.blocked && !this.paused && !this.complete()) this.start();
    else if (this.running) this.wake();
  }

  stitched() {
    return this.book?.provider === "elevenlabs";
  }

  // Next unit of work not already taken: a whole chapter when stitching,
  // otherwise a single passage ("ch|k"), nearest to the listener first.
  nextUnit(busy) {
    for (const ch of this.queue()) {
      if (this.stitched()) {
        if (!busy.has(ch)) return { ch };
        continue;
      }
      const n = this.book.chapters[ch].chunks.length;
      for (let k = 0; k < n; k++) if (!this.done.has(`${ch}|${k}`) && !busy.has(`${ch}|${k}`)) return { ch, k };
    }
    return null;
  }

  // Chapters this run may work on, nearest to the listener first.
  queue() {
    const n = this.book.chapters.length;
    const order = [];
    for (let i = this.focus; i < n; i++) order.push(i);
    for (let i = 0; i < this.focus; i++) order.push(i);
    const ahead = this.book.mode === "ahead" ? new Set([this.focus, this.focus + 1, this.focus + 2]) : null;
    return order.filter((ch) => (!ahead || ahead.has(ch)) && this.chapterDone(ch) < this.book.chapters[ch].chunks.length);
  }

  start() {
    if (this.running || !this.book) return;
    this.blocked = null;
    this.running = true;
    const ctrl = (this.ctrl = new AbortController());
    const busy = (this.busyChapters = new Set());
    this.emit("state");
    this.lock();
    const n = this.stitched() ? this.concurrency : PARALLEL_PASSAGES;
    const workers = Array.from({ length: n }, () => this.worker(ctrl.signal, busy));
    Promise.all(workers).then(() => {
      if (this.ctrl !== ctrl) return; // a newer run has taken over
      this.running = false;
      this.unlock();
      this.emit("state");
    });
  }

  stop() {
    this.ctrl?.abort();
    this.running = false;
    this.unlock();
  }

  async worker(signal, busy) {
    while (!signal.aborted && !this.blocked) {
      const unit = this.nextUnit(busy);
      if (unit) {
        const id = unit.k === undefined ? unit.ch : `${unit.ch}|${unit.k}`;
        busy.add(id);
        try {
          if (unit.k === undefined) await this.narrateChapter(unit.ch, signal);
          else await this.narrateChunk(unit.ch, unit.k, signal);
        } finally {
          busy.delete(id);
        }
        continue;
      }
      if (busy.size > 0) {
        await sleep(1000, signal); // the other worker may finish and free up work
        continue;
      }
      // Nothing left in range. In "ahead" mode, idle until the listener moves on.
      if (this.book.mode === "ahead" && !this.complete()) {
        await new Promise((resolve) => {
          this.wakers.push(resolve);
          signal.addEventListener("abort", resolve, { once: true });
        });
        continue;
      }
      return;
    }
  }

  wake() {
    const w = this.wakers;
    this.wakers = [];
    w.forEach((r) => r());
  }

  async narrateChapter(ch, signal) {
    const book = this.book;
    const n = book.chapters[ch].chunks.length;
    for (let k = 0; k < n; k++) {
      if (signal.aborted || this.blocked || book !== this.book) return;
      if (this.done.has(`${ch}|${k}`)) continue;
      if (!(await this.narrateChunk(ch, k, signal))) return;
    }
  }

  // Narrate one passage. Returns false if the run was stopped or blocked.
  async narrateChunk(ch, k, signal) {
    const book = this.book;
    const chapter = book.chapters[ch];
    const style = STYLES.find((s) => s.id === book.style) || STYLES[0];
    const chunk = chapter.chunks[k];
    const prev = chapter.chunks[k - 1];
    const next = chapter.chunks[k + 1];
    const recentIds = [];
    for (let j = Math.max(0, k - 3); j < k; j++) {
      const r = this.ids.get(`${ch}|${j}`);
      if (r && Date.now() - r.at < STITCH_WINDOW_MS) recentIds.push(r.id);
    }
    const params = {
      provider: book.provider,
      voice: book.voice,
      model: book.model,
      format: book.quality,
      text: chunk.text,
      previousText: prev ? prev.text.slice(-800) : "",
      nextText: next ? next.text.slice(0, 400) : "",
      previousRequestIds: this.stitched() && recentIds.length === Math.min(3, k) ? recentIds : [],
      instructions: style.direction,
      stability: style.stability,
      styleExaggeration: style.exaggeration,
      similarity: 0.8,
    };
    const out = await this.synthWithRetry(params, signal);
    if (!out || book !== this.book) return false;
    const prepared = await prepareChunk(out.data, out.type, chunk.pause);
    await db.putAudio(book.id, ch, k, { blob: prepared.blob, duration: prepared.duration, requestId: out.requestId, at: Date.now() });
    if (out.requestId) this.ids.set(`${ch}|${k}`, { id: out.requestId, at: Date.now() });
    this.done.set(`${ch}|${k}`, prepared.duration);
    this.emit("chunk", { ch, k, duration: prepared.duration });
    return true;
  }

  async synthWithRetry(params, signal) {
    let delay = 2000;
    for (let attempt = 0; attempt < 7; attempt++) {
      try {
        return await synth(params, signal);
      } catch (e) {
        if (e.name === "AbortError" || signal.aborted) return null;
        if (e.code === "stale_context" && params.previousRequestIds?.length) {
          params = { ...params, previousRequestIds: [] };
          continue;
        }
        if (FATAL.has(e.code) || (e.status >= 400 && e.status < 500 && e.status !== 429 && e.status !== 408)) {
          this.blocked = { message: e.message, code: e.code };
          this.emit("blocked", this.blocked);
          this.ctrl?.abort();
          return null;
        }
        this.emit("retry", { message: e.message, delay });
        await sleep(delay, signal);
        delay = Math.min(delay * 2, 30000);
      }
    }
    this.blocked = { message: "The voice service keeps failing. Try again in a few minutes.", code: "retries" };
    this.emit("blocked", this.blocked);
    return null;
  }

  async redoChapter(ch) {
    this.stop();
    await db.deleteChapterAudio(this.book.id, ch);
    for (const key of [...this.done.keys()]) if (key.startsWith(`${ch}|`)) this.done.delete(key);
    for (const key of [...this.ids.keys()]) if (key.startsWith(`${ch}|`)) this.ids.delete(key);
    this.emit("state");
    this.start();
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  async lock() {
    try {
      if (document.visibilityState === "visible" && navigator.wakeLock && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request("screen");
        this.wakeLock.addEventListener("release", () => (this.wakeLock = null));
      }
    } catch {
      // wake lock refused; generation still runs while the page is open
    }
  }
  unlock() {
    this.wakeLock?.release?.().catch(() => {});
    this.wakeLock = null;
  }
}
