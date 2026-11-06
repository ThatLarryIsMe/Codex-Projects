// Text lines → clean paragraphs → chapters. Pure functions (no DOM, no pdf.js),
// so this file also runs under Node for tests.

const CHAPTER_RE =
  /^(chapter|ch\.|part|book|volume|prologue|epilogue|introduction|preface|foreword|afterword|interlude|appendix|conclusion|postscript|coda)\b|^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)$|^[ivxlcdm]{1,7}\.?$|^\d{1,3}\.?$/i;
const SKIP_RE =
  /^(table of )?contents$|^index$|^copyright\b|^also by\b|^other books by\b|^about the publisher|^notes$|^endnotes$|^bibliography$|^references$|^works cited$|^praise for\b/i;
const SCENE_BREAK_RE = /^([*•·#~◆◇❖⁂§\-–—]\s*){1,7}$/;
const PAGE_NUM_RE = /^(page\s*)?([\divxlcdm]{1,6}|\d+\s*(of|\/)\s*\d+)$/i;

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const modeWeighted = (pairs) => {
  const m = new Map();
  for (const [k, w] of pairs) m.set(k, (m.get(k) || 0) + w);
  let best = null;
  let bw = -1;
  for (const [k, w] of m) if (w > bw) (best = k), (bw = w);
  return best;
};

export function cleanText(s) {
  return s
    .normalize("NFKC")
    .replace(/­/g, "") // soft hyphen
    .replace(/[​-‍﻿]/g, "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/\.\s?\.\s?\./g, "…")
    .replace(/\s+/g, " ")
    .trim();
}

const normKey = (s) => s.toLowerCase().replace(/\d+/g, "#").replace(/[^a-z#]/g, "");

function titleCase(s) {
  if (s !== s.toUpperCase() || !/[A-Z]/.test(s)) return s;
  const small = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (/^[ivxlcdm]+\.?$/.test(w) && w.length <= 6 ? w.toUpperCase() : i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// Small-caps openers ("THE RAIN HAD stopped") would be read as acronyms.
function fixCapsOpener(s) {
  return s.replace(/^((?:["']?[A-Z][A-Z'’]+[,;]?\s+){2,}[A-Z][A-Z'’]*)(?=\b)/, (m) => {
    const lower = m.toLowerCase();
    return lower.replace(/[a-z]/, (c) => c.toUpperCase()).replace(/\bi\b/g, "I");
  });
}

// 1) Remove running headers, footers and page numbers.
function stripFurniture(pages) {
  const counts = new Map();
  const n = pages.length;
  const edge = (l) => l.yFrac < 0.1 || l.yFrac > 0.9;
  for (const lines of pages) {
    const seen = new Set();
    for (const l of lines) {
      if (!edge(l)) continue;
      const k = normKey(l.text);
      if (k && !seen.has(k)) {
        seen.add(k);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
  }
  const threshold = Math.max(3, Math.min(8, Math.round(n * 0.08)));
  return pages.map((lines) =>
    lines.filter((l) => {
      if (!edge(l)) return true;
      if (PAGE_NUM_RE.test(l.text.trim())) return false;
      const k = normKey(l.text);
      // "12 | The Title" style headers collapse to a repeated key.
      return !(k && counts.get(k) >= threshold && n >= 4);
    })
  );
}

// 2) Lines → blocks (paragraphs, headings, scene breaks).
function toBlocks(pages) {
  const all = pages.flat();
  const bodySize = modeWeighted(all.map((l) => [Math.round(l.size * 2) / 2, l.text.length])) || 10;
  const bodyLines = all.filter((l) => Math.abs(l.size - bodySize) < 0.6);
  const bodyLeft = median(bodyLines.map((l) => Math.round(l.x)));
  const rightEdge = median(bodyLines.filter((l) => l.text.length > 40).map((l) => l.xEnd)) || Math.max(...bodyLines.map((l) => l.xEnd), 0);
  const gaps = [];
  for (const lines of pages)
    for (let i = 1; i < lines.length; i++) {
      const g = lines[i - 1].y - lines[i].y;
      if (g > 0 && Math.abs(lines[i].size - bodySize) < 0.6 && Math.abs(lines[i - 1].size - bodySize) < 0.6) gaps.push(g);
    }
  const lineGap = median(gaps) || bodySize * 1.3;

  // Word list for deciding whether "some-\nthing" is "something" or "some-thing".
  const vocab = new Map();
  for (const l of all) for (const w of l.text.toLowerCase().replace(/[\u2010\u2011]/g, "-").replace(/[a-z]+-$/, "").match(/[a-z]+(?:-[a-z]+)*/g) || []) vocab.set(w, (vocab.get(w) || 0) + 1);

  const blocks = [];
  let cur = null;
  let prev = null;
  let pendingDropCap = "";
  const flush = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };

  for (const lines of pages) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const text = l.text;
      const gapBefore = prev && prev.page === l.page ? prev.y - l.y : null;
      const big = l.size >= bodySize * 1.18;
      const small = l.size < bodySize * 0.8;
      const isolated = gapBefore === null || gapBefore > lineGap * 1.45 || i === 0;

      if (small && (l.yFrac > 0.6 || /^([\d*†‡§]+[.)]?\s)/.test(text) || prev?.footnote)) {
        // Footnotes: small type at the foot of the page, or starting with a note marker.
        l.footnote = true;
        prev = l;
        continue;
      }
      if (big && /^[A-Z]$/.test(text)) {
        // Drop cap: glue the oversized first letter onto the next line.
        pendingDropCap = text;
        prev = l;
        continue;
      }
      if (SCENE_BREAK_RE.test(text) && text.length < 20) {
        flush();
        blocks.push({ kind: "break" });
        prev = l;
        continue;
      }
      const tocLike = /(\.{2,}|…|\s)\d{1,4}$/.test(text) && text.split(/\s+/).length >= 3;
      const keywordHeading = CHAPTER_RE.test(text) && text.length <= 60 && isolated && !tocLike && !/[.,;]\s*\w/.test(text.replace(/^(ch\.)/i, ""));
      if ((big && text.length <= 140 && !tocLike) || keywordHeading) {
        const bothNumbered = cur?.kind === "h" && CHAPTER_RE.test(cur.parts[cur.parts.length - 1]) && CHAPTER_RE.test(text);
        const closeToPrev = prev && prev.page === l.page && prev.y - l.y < lineGap * 4;
        if (cur?.kind === "h" && closeToPrev && !bothNumbered && cur.parts.length < 3 && cur.parts.join(" ").length + text.length < 160) {
          cur.parts.push(text);
          cur.size = Math.max(cur.size, l.size);
          cur.keyword = cur.keyword || keywordHeading;
        } else {
          flush();
          cur = { kind: "h", parts: [text], size: l.size, keyword: CHAPTER_RE.test(text), page: l.page, line: l };
        }
        prev = l;
        continue;
      }

      let body = pendingDropCap ? pendingDropCap + text : text;
      pendingDropCap = "";
      let newPara = true;
      if (cur?.kind === "p" && prev) {
        const samePage = prev.page === l.page;
        const indented = l.x > bodyLeft + bodySize * 0.8 && l.x < bodyLeft + bodySize * 8;
        const endsSentence = /[.!?"'”’):…]$/.test(prev.text);
        const shortPrev = prev.xEnd < rightEdge - bodySize * 3.5;
        const gapBreak = samePage && gapBefore > lineGap * 1.45;
        // An indent only starts a paragraph after a line that could end one
        // (text wrapping around a drop cap or figure is indented too).
        newPara = gapBreak || (shortPrev && endsSentence) || (indented && (endsSentence || shortPrev));
      }
      if (!newPara) {
        const last = cur.text;
        const m = last.match(/([A-Za-z]+)[-\u2010\u2011]$/);
        const n2 = body.match(/^([a-z]+)/);
        if (m && n2) {
          const joined = (m[1] + n2[1]).toLowerCase();
          const hyph = `${m[1]}-${n2[1]}`.toLowerCase();
          cur.text = (vocab.get(hyph) || 0) > (vocab.get(joined) || 0) ? last.slice(0, -1) + "-" + body : last.slice(0, -1) + body;
        } else if (/[—–]$/.test(last)) {
          cur.text = last + body;
        } else cur.text = last + " " + body;
      } else {
        flush();
        cur = { kind: "p", text: body, page: l.page, line: l };
      }
      prev = l;
    }
  }
  flush();

  return blocks
    .map((b) => {
      if (b.kind === "h") {
        const parts = b.parts.map((t) => titleCase(cleanText(t)));
        let title = parts[0];
        for (const p of parts.slice(1)) title += CHAPTER_RE.test(parts[0]) && !/[:.]$/.test(title) && !/^(chapter|part|book)$/i.test(title) ? ": " + p : " " + p;
        return { kind: "h", text: title, parts, size: b.size, keyword: b.keyword, page: b.page, y: b.line.y };
      }
      if (b.kind === "p") return { kind: "p", text: fixCapsOpener(cleanText(b.text)), page: b.page, y: b.line.y };
      return b;
    })
    .filter((b) => b.kind !== "p" || b.text);
}

const countWords = (s) => (s.match(/\S+/g) || []).length;

function finalizeChapter(title, blocks) {
  const paragraphs = [];
  for (const b of blocks) {
    if (b.kind === "p") paragraphs.push({ kind: "p", text: b.text });
    else if (b.kind === "h") paragraphs.push({ kind: "h", text: b.text });
    else if (paragraphs.length && paragraphs[paragraphs.length - 1].kind !== "break") paragraphs.push({ kind: "break" });
  }
  while (paragraphs.length && paragraphs[paragraphs.length - 1].kind === "break") paragraphs.pop();
  const text = paragraphs.filter((p) => p.text).map((p) => p.text).join(" ");
  return { title, paragraphs, words: countWords(text), chars: text.length };
}

const simplify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// 3) Blocks → chapters, preferring the PDF's own bookmarks.
function chaptersFromOutline(blocks, outline) {
  if (outline.length < 2) return null;
  let entries = outline.filter((o) => o.depth === 0);
  if (entries.length < 3) entries = outline.filter((o) => o.depth <= 1);
  entries = entries.filter((o, i, a) => a.findIndex((x) => x.page === o.page && x.title === o.title) === i).sort((a, b) => a.page - b.page);
  if (entries.length < 2) return null;

  // Find where each entry starts: its heading on the target page, else the page's first block.
  const starts = entries.map((e) => {
    const t = simplify(e.title);
    let idx = blocks.findIndex((b) => b.page === e.page && b.kind === "h" && t && (simplify(b.text).includes(t) || t.includes(simplify(b.text))));
    // The heading on the page often says more than the bookmark ("Chapter 1" → "Chapter 1: The Keeper").
    if (idx >= 0 && simplify(blocks[idx].text).length > t.length && simplify(blocks[idx].text).startsWith(t)) e.title = blocks[idx].text;
    if (idx < 0) idx = blocks.findIndex((b) => b.page >= e.page);
    return idx < 0 ? blocks.length : idx;
  });
  const chapters = [];
  if (starts[0] > 0) chapters.push({ ...finalizeChapter("Front matter", blocks.slice(0, starts[0])), front: true });
  for (let i = 0; i < entries.length; i++) {
    const s = starts[i];
    const e = i + 1 < entries.length ? Math.max(s, starts[i + 1]) : blocks.length;
    let body = blocks.slice(s, e);
    // Drop the heading block that duplicates the bookmark title.
    if (body[0]?.kind === "h") body = body.slice(1);
    chapters.push(finalizeChapter(titleCase(cleanText(entries[i].title)), body));
  }
  return chapters;
}

// Three or more chapter headings in a row with nothing between them is a
// table of contents, not the start of three chapters.
function demoteTocRuns(blocks) {
  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].kind !== "h") {
      i++;
      continue;
    }
    let j = i;
    while (j < blocks.length && (blocks[j].kind === "h" || (blocks[j].kind === "p" && blocks[j].text.length < 60 && /\d$/.test(blocks[j].text)))) j++;
    if (j - i >= 3) for (let k = i; k < j; k++) blocks[k] = { kind: "p", text: blocks[k].text, page: blocks[k].page, toc: true };
    i = Math.max(j, i + 1);
  }
  return blocks;
}

function chaptersFromHeadings(blocks) {
  const heads = blocks.map((b, i) => ({ b, i })).filter((x) => x.b.kind === "h");
  let chosen = heads.filter((x) => x.b.keyword);
  if (chosen.length < 2) {
    // Largest heading size that recurs is the chapter level.
    const sizes = [...new Set(heads.map((x) => Math.round(x.b.size)))].sort((a, b) => b - a);
    chosen = [];
    for (const s of sizes) {
      const at = heads.filter((x) => Math.round(x.b.size) >= s);
      if (at.length >= 2) {
        chosen = at;
        break;
      }
    }
  }
  if (chosen.length < 2) return null;
  const chapters = [];
  if (chosen[0].i > 0) chapters.push({ ...finalizeChapter("Front matter", blocks.slice(0, chosen[0].i)), front: true });
  chosen.forEach((x, k) => {
    const end = k + 1 < chosen.length ? chosen[k + 1].i : blocks.length;
    chapters.push(finalizeChapter(x.b.text, blocks.slice(x.i + 1, end)));
  });
  return chapters;
}

function chaptersBySize(blocks, targetWords = 4500) {
  const chapters = [];
  let acc = [];
  let words = 0;
  for (const b of blocks) {
    acc.push(b);
    if (b.text) words += countWords(b.text);
    if (words >= targetWords && b.kind === "p") {
      chapters.push(finalizeChapter(`Part ${chapters.length + 1}`, acc));
      acc = [];
      words = 0;
    }
  }
  if (acc.length) {
    if (chapters.length && words < targetWords / 4) {
      const last = chapters.pop();
      chapters.push(finalizeChapter(last.title, [...last.paragraphs, ...acc]));
    } else chapters.push(finalizeChapter(`Part ${chapters.length + 1}`, acc));
  }
  return chapters;
}

export function buildBook({ pages, outline = [], metaTitle, metaAuthor, fileName = "Untitled.pdf" }) {
  const totalChars = pages.flat().reduce((s, l) => s + l.text.length, 0);
  if (totalChars < 200 * Math.min(3, pages.length)) {
    const err = new Error("This PDF has no readable text layer. It is probably scanned page images, which need OCR (text recognition) before they can be narrated.");
    err.code = "no_text";
    throw err;
  }
  const blocks = toBlocks(stripFurniture(pages));
  let chapters = chaptersFromOutline(blocks, outline) || chaptersFromHeadings(demoteTocRuns(blocks)) || chaptersBySize(blocks);

  // Fold near-empty chapters (e.g. a "Part One" divider page) into the next one.
  const merged = [];
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    const next = chapters[i + 1];
    if (c.words < 25 && next && !c.front && !SKIP_RE.test(c.title.trim()) && (/^(part|book|volume)\b/i.test(c.title) || c.words === 0)) {
      const lead = c.paragraphs.filter((p) => p.text).length ? c.paragraphs : [];
      chapters[i + 1] = { ...finalizeChapter(`${c.title}: ${next.title}`, [...lead, ...next.paragraphs]) };
      continue;
    }
    merged.push(c);
  }
  // Short sections ahead of the first real chapter (title page, dedication) default to off.
  const firstReal = merged.findIndex((c) => CHAPTER_RE.test(c.title.trim()));
  merged.forEach((c, i) => {
    if (i < firstReal && c.words < 150) c.front = true;
  });
  chapters = merged
    .filter((c) => c.words > 0 || c.paragraphs.length)
    .map((c, i) => ({
      id: i,
      title: c.title,
      paragraphs: c.paragraphs,
      words: c.words,
      chars: c.chars,
      include: !c.front && !SKIP_RE.test(c.title.trim()) && c.words > 0 && !looksLikeToc(c),
      front: Boolean(c.front),
    }));

  const fromFile = fileName.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim();
  // No usable metadata: the largest heading on the first pages is the title,
  // and a short name-like line set with it is the author.
  const titlePage = blocks.filter((b) => b.kind === "h" && b.page <= 3).sort((a, b) => b.size - a.size)[0];
  if (!metaAuthor && titlePage?.parts?.length > 1) {
    const cand = titlePage.parts[1].replace(/^by\s+/i, "");
    if (/^([A-Z][\w.'-]*\s?){2,4}$/.test(cand) && cand.length < 50) metaAuthor = cand;
  }
  if (!metaTitle?.trim() && titlePage && titlePage.parts[0].length < 90) metaTitle = titlePage.parts[0];
  const title = metaTitle && metaTitle.trim().length > 1 && !/^(untitled|microsoft word|document\d*)/i.test(metaTitle.trim()) && !/\.(docx?|indd|pdf)$/i.test(metaTitle.trim()) ? metaTitle.trim() : fromFile;
  return { title: titleCase(title), author: (metaAuthor || "").trim(), chapters };
}

// A chapter that is mostly short lines ending in page numbers is a table of contents.
function looksLikeToc(c) {
  const ps = c.paragraphs.filter((p) => p.kind === "p");
  if (ps.length < 4) return false;
  const withNums = ps.filter((p) => /(\.{2,}|…|\s)\d{1,4}$/.test(p.text) && p.text.length < 120).length;
  return withNums / ps.length > 0.5;
}
