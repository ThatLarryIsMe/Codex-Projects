// Audiobook player. Plays a chapter's chunks back to back through one <audio>
// element (the next chunk is preloaded, so the hand-off is instant and keeps
// working on a locked phone). Presents each chapter as one continuous track.
import { db } from "./db.js";

export class Player extends EventTarget {
  constructor(generator) {
    super();
    this.gen = generator;
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.preservesPitch = true;
    this.audio.mozPreservesPitch = true;
    this.audio.webkitPreservesPitch = true;
    this.book = null;
    this.ch = 0;
    this.k = 0;
    this.waiting = false; // wants to play but the next chunk isn't narrated yet
    this.wantPlay = false;
    this.rate = 1;
    this.url = null;
    this.next = null; // { ch, k, url }
    this.sleep = null; // { until } | { chapter: true }
    this.lastSave = 0;

    this.audio.addEventListener("ended", () => this.advance());
    this.audio.addEventListener("timeupdate", () => this.tick());
    this.audio.addEventListener("play", () => this.emit("state"));
    this.audio.addEventListener("pause", () => this.emit("state"));
    this.audio.addEventListener("error", () => {
      if (this.audio.src) this.emit("error", { message: "This part of the audio could not be played." });
    });
    generator.addEventListener("chunk", (e) => {
      const { ch, k } = e.detail;
      if (!this.book) return;
      if (this.waiting && ch === this.ch && k === this.k) this.resumeWaiting();
      else if (ch === this.ch && k === this.k + 1) this.preloadNext();
      this.emit("time");
    });
    this.setupMediaSession();
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  get playing() {
    return this.wantPlay && (!this.audio.paused || this.waiting);
  }

  chapterChunks(ch = this.ch) {
    return this.book.chapters[ch].chunks;
  }
  dur(ch, k) {
    return this.gen.done.get(`${ch}|${k}`) || 0;
  }
  // Duration of the chapter: narrated chunks exactly, the rest estimated.
  chapterDuration(ch = this.ch) {
    const chunks = this.chapterChunks(ch);
    let t = 0;
    for (let k = 0; k < chunks.length; k++) t += this.dur(ch, k) || chunks[k].text.length / 15;
    return t;
  }
  chapterTime() {
    let t = 0;
    for (let k = 0; k < this.k; k++) t += this.dur(this.ch, k) || this.chapterChunks()[k].text.length / 15;
    return t + (this.audio.src ? this.audio.currentTime : this.offset || 0);
  }
  // Furthest point in this chapter that has been narrated without gaps.
  readyUntil(ch = this.ch) {
    const chunks = this.chapterChunks(ch);
    let t = 0;
    for (let k = 0; k < chunks.length; k++) {
      if (!this.gen.isReady(ch, k)) break;
      t += this.dur(ch, k);
    }
    return t;
  }

  async load(book, cover) {
    this.pause();
    this.book = book;
    this.cover = cover;
    this.clearSrc();
    const p = (await db.getProgress(book.id)) || { ch: 0, k: 0, t: 0 };
    this.ch = Math.min(p.ch || 0, book.chapters.length - 1);
    this.k = Math.min(p.k || 0, this.chapterChunks().length - 1);
    this.offset = p.t || 0;
    this.gen.setFocus(this.ch);
    this.updateMetadata();
    this.emit("chapter");
    this.emit("time");
  }

  clearSrc() {
    this.audio.removeAttribute("src");
    this.audio.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    if (this.next) URL.revokeObjectURL(this.next.url);
    this.next = null;
  }

  async play() {
    if (!this.book) return;
    this.wantPlay = true;
    if (this.audio.src && !this.waiting) {
      this.audio.playbackRate = this.rate;
      try {
        await this.audio.play();
      } catch (e) {
        this.wantPlay = false;
        this.emit("error", { message: e.message });
      }
      return;
    }
    await this.startChunk(this.ch, this.k, this.offset || 0);
  }

  pause() {
    this.wantPlay = false;
    this.waiting = false;
    this.audio.pause();
    this.save(true);
    this.emit("state");
  }

  toggle() {
    return this.playing ? this.pause() : this.play();
  }

  async startChunk(ch, k, offset = 0) {
    this.ch = ch;
    this.k = k;
    this.offset = offset;
    if (!this.gen.isReady(ch, k)) {
      this.waiting = true;
      this.clearSrc();
      this.gen.setFocus(ch);
      this.emit("state");
      return;
    }
    this.waiting = false;
    let url;
    if (this.next && this.next.ch === ch && this.next.k === k) {
      url = this.next.url;
      this.next = null;
    } else {
      const rec = await db.getAudio(this.book.id, ch, k);
      if (!rec) {
        this.gen.done.delete(`${ch}|${k}`);
        return this.startChunk(ch, k, offset);
      }
      url = URL.createObjectURL(rec.blob);
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = url;
    this.audio.src = url;
    this.audio.playbackRate = this.rate;
    if (offset > 0) {
      await new Promise((r) => {
        if (this.audio.readyState >= 1) r();
        else this.audio.addEventListener("loadedmetadata", r, { once: true });
      });
      this.audio.currentTime = Math.min(offset, this.dur(ch, k) - 0.05);
    }
    this.offset = 0;
    if (this.wantPlay) {
      try {
        await this.audio.play();
      } catch (e) {
        this.wantPlay = false;
        this.emit("error", { message: e.message });
      }
    }
    this.gen.setFocus(ch);
    this.emit("state");
    this.emit("time");
    this.save(true);
    this.preloadNext();
  }

  nextPos(ch = this.ch, k = this.k) {
    if (k + 1 < this.chapterChunks(ch).length) return { ch, k: k + 1 };
    if (ch + 1 < this.book.chapters.length) return { ch: ch + 1, k: 0 };
    return null;
  }

  async preloadNext() {
    const n = this.nextPos();
    if (!n || (this.next && this.next.ch === n.ch && this.next.k === n.k) || !this.gen.isReady(n.ch, n.k)) return;
    const rec = await db.getAudio(this.book.id, n.ch, n.k);
    if (!rec) return;
    if (this.next) URL.revokeObjectURL(this.next.url);
    this.next = { ...n, url: URL.createObjectURL(rec.blob) };
  }

  advance() {
    const n = this.nextPos();
    const chapterChanged = n && n.ch !== this.ch;
    if (this.sleep?.chapter && (chapterChanged || !n)) {
      this.sleep = null;
      this.emit("sleep");
      if (n) {
        this.ch = n.ch;
        this.k = 0;
        this.offset = 0;
        this.clearSrc();
        this.emit("chapter");
      }
      return this.pause();
    }
    if (!n) {
      this.wantPlay = false;
      this.save(true);
      this.emit("finished");
      this.emit("state");
      return;
    }
    // Hand off synchronously when the next chunk is preloaded (lock-screen safe).
    if (this.next && this.next.ch === n.ch && this.next.k === n.k) {
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = this.next.url;
      this.next = null;
      this.ch = n.ch;
      this.k = n.k;
      this.audio.src = this.url;
      this.audio.playbackRate = this.rate;
      this.audio.play().catch(() => {});
      this.preloadNext();
    } else {
      this.startChunk(n.ch, n.k, 0);
    }
    if (chapterChanged) {
      this.updateMetadata();
      this.emit("chapter");
      this.gen.setFocus(n.ch);
    }
    this.save(true);
  }

  resumeWaiting() {
    if (!this.waiting) return;
    this.startChunk(this.ch, this.k, this.offset || 0);
  }

  // Seek within the current chapter (seconds).
  async seek(t) {
    const chunks = this.chapterChunks();
    t = Math.max(0, Math.min(t, this.readyUntil() - 0.1));
    let acc = 0;
    for (let k = 0; k < chunks.length; k++) {
      const d = this.dur(this.ch, k);
      if (!d) break;
      if (t < acc + d || k === chunks.length - 1) {
        if (k === this.k && this.audio.src) this.audio.currentTime = Math.max(0, t - acc);
        else await this.startChunk(this.ch, k, Math.max(0, t - acc));
        this.save(true);
        this.emit("time");
        return;
      }
      acc += d;
    }
  }

  skip(delta) {
    const t = this.chapterTime() + delta;
    if (t < 0 && this.ch > 0 && this.chapterTime() < 2) return this.goChapter(this.ch - 1);
    return this.seek(Math.max(0, t));
  }

  async goChapter(ch) {
    if (!this.book || ch < 0 || ch >= this.book.chapters.length) return;
    this.clearSrc();
    this.ch = ch;
    this.k = 0;
    this.offset = 0;
    this.updateMetadata();
    this.emit("chapter");
    this.gen.setFocus(ch);
    if (this.wantPlay) await this.startChunk(ch, 0, 0);
    else {
      this.waiting = false;
      this.save(true);
      this.emit("time");
    }
  }

  async goChunk(ch, k) {
    if (ch !== this.ch) {
      this.ch = ch;
      this.updateMetadata();
      this.emit("chapter");
    }
    this.wantPlay = true;
    await this.startChunk(ch, k, 0);
  }

  setRate(r) {
    this.rate = r;
    this.audio.playbackRate = r;
    this.emit("state");
  }

  setSleep(minutes) {
    clearTimeout(this.sleepTimer);
    if (minutes === "chapter") this.sleep = { chapter: true };
    else if (minutes > 0) {
      this.sleep = { until: Date.now() + minutes * 60000 };
      this.sleepTimer = setTimeout(() => {
        this.sleep = null;
        this.pause();
        this.emit("sleep");
      }, minutes * 60000);
    } else this.sleep = null;
    this.emit("sleep");
  }

  tick() {
    this.emit("time");
    if (this.sleep?.until && Date.now() >= this.sleep.until) {
      this.sleep = null;
      this.pause();
      this.emit("sleep");
    }
    this.save();
    this.updatePosition();
  }

  save(force) {
    if (!this.book) return;
    const now = Date.now();
    if (!force && now - this.lastSave < 4000) return;
    this.lastSave = now;
    const t = this.audio.src ? this.audio.currentTime : this.offset || 0;
    const pos = { ch: this.ch, k: this.k, t, updatedAt: now, chapterTime: this.chapterTime() };
    db.putProgress(this.book.id, pos).catch(() => {});
    this.emit("saved", pos);
  }

  // ---- Lock screen / headphone controls ----
  setupMediaSession() {
    const ms = navigator.mediaSession;
    if (!ms) return;
    const on = (a, f) => {
      try {
        ms.setActionHandler(a, f);
      } catch {
        // action unsupported on this platform
      }
    };
    on("play", () => this.play());
    on("pause", () => this.pause());
    on("seekbackward", (d) => this.skip(-(d.seekOffset || 15)));
    on("seekforward", (d) => this.skip(d.seekOffset || 30));
    on("previoustrack", () => (this.chapterTime() > 5 ? this.seek(0) : this.goChapter(this.ch - 1)));
    on("nexttrack", () => this.goChapter(this.ch + 1));
    on("seekto", (d) => this.seek(d.seekTime));
  }

  updateMetadata() {
    if (!navigator.mediaSession || !this.book || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: this.book.chapters[this.ch].title,
      artist: this.book.author || "Tellwell",
      album: this.book.title,
      artwork: this.cover ? [{ src: this.cover, sizes: "512x512", type: "image/png" }] : [],
    });
  }

  updatePosition() {
    const ms = navigator.mediaSession;
    if (!ms?.setPositionState || !this.book) return;
    try {
      const duration = Math.max(this.chapterDuration(), 1);
      ms.setPositionState({ duration, position: Math.min(this.chapterTime(), duration), playbackRate: this.rate });
    } catch {
      // ignore invalid states while switching chunks
    }
  }
}
