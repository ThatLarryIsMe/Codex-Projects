// Chapter → narration chunks. Chunks break only at paragraph or sentence
// boundaries, and carry the silence that should follow them, so the stitched
// result breathes like a human reading: a beat after the chapter title, a
// paragraph pause, a longer rest at scene breaks and at the end of a chapter.

export const PAUSE = { sentence: 60, paragraph: 380, subheading: 700, title: 1300, scene: 1600, chapterEnd: 2600 };

const ABBREV = /\b(Mr|Mrs|Ms|Mx|Dr|St|Jr|Sr|Prof|Gen|Col|Capt|Lt|Sgt|Mt|Ft|Rev|Fr|vs|etc|e\.g|i\.e|cf|No|Vol|pp|Inc|Ltd|Co)\.$/i;

export function splitSentences(text) {
  const out = [];
  const re = /[.!?…]+["'”’)\]]*\s+(?=["'“‘(\[]?[A-Z0-9])/g;
  let start = 0;
  let m;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    const candidate = text.slice(start, end).trim();
    if (ABBREV.test(candidate.replace(/["'”’)\]]+$/, "")) || /\b[A-Z]\.$/.test(candidate)) continue;
    out.push(candidate);
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

// Spoken form of a chapter title: "Chapter 3: The Long Night" → "Chapter 3. The Long Night."
export function spokenTitle(title) {
  let t = title.trim().replace(/\s*[:—–-]\s*/g, ". ");
  if (!/[.!?]$/.test(t)) t += ".";
  return t;
}

export function chunkChapter(chapter, maxChars = 1800) {
  const chunks = [];
  const push = (text, pause, kind = "body") => {
    text = text.trim();
    if (text) chunks.push({ text, pause, kind });
  };
  push(spokenTitle(chapter.title), PAUSE.title, "title");

  let buf = [];
  let len = 0;
  const flush = (pause) => {
    if (buf.length) push(buf.join("\n\n"), pause);
    buf = [];
    len = 0;
  };

  for (const p of chapter.paragraphs) {
    if (p.kind === "break") {
      flush(PAUSE.scene);
      if (chunks.length) chunks[chunks.length - 1].pause = Math.max(chunks[chunks.length - 1].pause, PAUSE.scene);
      continue;
    }
    if (p.kind === "h") {
      flush(PAUSE.paragraph);
      push(spokenTitle(p.text), PAUSE.subheading, "subheading");
      continue;
    }
    const text = p.text;
    if (len + text.length + 2 <= maxChars) {
      buf.push(text);
      len += text.length + 2;
      continue;
    }
    flush(PAUSE.paragraph);
    if (text.length <= maxChars) {
      buf.push(text);
      len = text.length;
      continue;
    }
    // A paragraph longer than one chunk: split between sentences.
    let piece = "";
    for (const s of splitSentences(text)) {
      if (piece && piece.length + s.length + 1 > maxChars) {
        push(piece, PAUSE.sentence);
        piece = "";
      }
      if (s.length > maxChars) {
        // A single monster sentence: split on clause punctuation, then words.
        for (const part of s.match(new RegExp(`.{1,${maxChars}}(?:[,;:—]\\s|\\s|$)`, "g")) || [s]) push(part, PAUSE.sentence);
        continue;
      }
      piece = piece ? piece + " " + s : s;
    }
    if (piece) {
      buf.push(piece);
      len = piece.length;
    }
  }
  flush(PAUSE.paragraph);
  if (chunks.length) chunks[chunks.length - 1].pause = PAUSE.chapterEnd;
  return chunks;
}
