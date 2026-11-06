// Tiny IndexedDB layer. Everything (books, audio, progress) lives on this device.
const DB_NAME = "tellwell";
const VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "id" });
      if (!db.objectStoreNames.contains("audio")) db.createObjectStore("audio");
      if (!db.objectStoreNames.contains("progress")) db.createObjectStore("progress");
      if (!db.objectStoreNames.contains("previews")) db.createObjectStore("previews");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let out;
        const r = fn(s);
        if (r && "onsuccess" in r) r.onsuccess = () => (out = r.result);
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error("Storage transaction aborted"));
      })
  );
}

export const audioKey = (bookId, ch, k) => `${bookId}|${ch}|${k}`;

export const db = {
  getBook: (id) => tx("books", "readonly", (s) => s.get(id)),
  putBook: (b) => tx("books", "readwrite", (s) => s.put(b)),
  allBooks: () => tx("books", "readonly", (s) => s.getAll()),
  getAudio: (bookId, ch, k) => tx("audio", "readonly", (s) => s.get(audioKey(bookId, ch, k))),
  putAudio: (bookId, ch, k, rec) => tx("audio", "readwrite", (s) => s.put(rec, audioKey(bookId, ch, k))),
  // Which chunks of a book already have audio: Map("ch|k" → duration)
  async audioIndex(bookId) {
    const range = IDBKeyRange.bound(`${bookId}|`, `${bookId}|￿`);
    const db_ = await open();
    return new Promise((resolve, reject) => {
      const out = new Map();
      const t = db_.transaction("audio", "readonly");
      const req = t.objectStore("audio").openCursor(range);
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        out.set(c.key.slice(bookId.length + 1), c.value.duration || 0);
        c.continue();
      };
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
    });
  },
  getProgress: (id) => tx("progress", "readonly", (s) => s.get(id)),
  putProgress: (id, p) => tx("progress", "readwrite", (s) => s.put(p, id)),
  getPreview: (k) => tx("previews", "readonly", (s) => s.get(k)),
  putPreview: (k, blob) => tx("previews", "readwrite", (s) => s.put(blob, k)),
  async deleteBook(id) {
    await tx("books", "readwrite", (s) => s.delete(id));
    await tx("progress", "readwrite", (s) => s.delete(id));
    await tx("audio", "readwrite", (s) => s.delete(IDBKeyRange.bound(`${id}|`, `${id}|￿`)));
  },
  async deleteChapterAudio(id, ch) {
    await tx("audio", "readwrite", (s) => s.delete(IDBKeyRange.bound(`${id}|${ch}|`, `${id}|${ch}|￿`)));
  },
};

export async function storageInfo() {
  try {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    return { usage: est?.usage || 0, quota: est?.quota || 0, persisted: Boolean(persisted) };
  } catch {
    return { usage: 0, quota: 0, persisted: false };
  }
}

export async function askPersist() {
  try {
    return await navigator.storage?.persist?.();
  } catch {
    return false;
  }
}
