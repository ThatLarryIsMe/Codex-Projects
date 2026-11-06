// PDF → positioned text lines, using pdf.js. Structure detection lives in structure.js.
import * as pdfjs from "../vendor/pdfjs/pdf.min.mjs";
import { buildBook } from "./structure.js";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;

function itemSize(it) {
  const t = it.transform;
  return Math.hypot(t[2], t[3]) || it.height || 10;
}

// Group a page's text items into visual lines (top to bottom, left to right).
function pageLines(items, pageIndex, pageHeight) {
  const parts = [];
  for (const it of items) {
    if (typeof it.str !== "string" || !it.str.length) continue;
    const size = itemSize(it);
    parts.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, size, font: it.fontName });
  }
  parts.sort((a, b) => b.y - a.y || a.x - b.x);

  // Drop caps: an oversized single letter that belongs to the line beside its top.
  const sizes = parts.map((p) => p.size).sort((a, b) => a - b);
  const typical = sizes[Math.floor(sizes.length / 2)] || 10;
  const drops = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.size > typical * 1.8 && /^[A-Z0-9"“']$/.test(p.str.trim())) drops.push(...parts.splice(i, 1));
  }

  const lines = [];
  for (const p of parts) {
    const line = lines.find((l) => Math.abs(l.y - p.y) < Math.max(2, Math.min(l.size, p.size) * 0.5));
    if (line) {
      line.parts.push(p);
      line.size = Math.max(line.size, p.size);
    } else lines.push({ y: p.y, size: p.size, parts: [p] });
  }
  lines.sort((a, b) => b.y - a.y);
  for (const d of drops) {
    // Topmost line whose baseline sits within the letter's height, to its right.
    const target = lines.find((l) => l.y <= d.y + d.size * 0.9 && l.y >= d.y - 2 && l.parts[0].x > d.x);
    if (target) {
      target.parts.push({ ...d, str: d.str.trim(), x: target.parts.reduce((m, q) => Math.min(m, q.x), Infinity) - 0.01, w: 0, size: target.size, drop: true });
    } else lines.push({ y: d.y, size: d.size, parts: [d] });
  }
  lines.sort((a, b) => b.y - a.y);

  return lines
    .map((l) => {
      l.parts.sort((a, b) => a.x - b.x);
      // Body size of the line = size of the bulk of its characters.
      const bySize = new Map();
      for (const p of l.parts) bySize.set(Math.round(p.size * 2) / 2, (bySize.get(Math.round(p.size * 2) / 2) || 0) + p.str.length);
      const size = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0][0];
      let text = "";
      let prevEnd = null;
      for (const p of l.parts) {
        // Drop superscript footnote markers: tiny digits/daggers hanging off words.
        if (p.size < size * 0.75 && /^[\d*†‡§]+$/.test(p.str.trim())) continue;
        if (!p.drop && prevEnd !== null && p.x - prevEnd > size * 0.15 && !/\s$/.test(text) && !/^\s/.test(p.str)) text += " ";
        text += p.str;
        prevEnd = p.drop ? null : p.x + p.w;
      }
      const first = l.parts.find((p) => !p.drop) || l.parts[0];
      const last = l.parts[l.parts.length - 1];
      return {
        text: text.replace(/\s+/g, " ").trim(),
        x: first.x,
        xEnd: last.x + last.w,
        y: l.y,
        yFrac: pageHeight ? 1 - l.y / pageHeight : 0.5, // 0 = top of page
        size,
        page: pageIndex,
      };
    })
    .filter((l) => l.text);
}

async function resolveOutline(pdf) {
  let outline;
  try {
    outline = await pdf.getOutline();
  } catch {
    return [];
  }
  if (!outline?.length) return [];
  const flat = [];
  const walk = async (items, depth) => {
    for (const it of items) {
      let page = null;
      try {
        let dest = it.dest;
        if (typeof dest === "string") dest = await pdf.getDestination(dest);
        if (Array.isArray(dest)) {
          const ref = dest[0];
          page = typeof ref === "number" ? ref : await pdf.getPageIndex(ref);
        }
      } catch {
        // unresolvable destination
      }
      if (page !== null && it.title?.trim()) flat.push({ title: it.title.trim(), page, depth });
      if (it.items?.length && depth < 2) await walk(it.items, depth + 1);
    }
  };
  await walk(outline, 0);
  return flat;
}

export async function extractPdf(arrayBuffer, fileName, onProgress = () => {}) {
  const pdf = await pdfjs.getDocument({ data: arrayBuffer, isEvalSupported: false, useSystemFonts: true }).promise;
  const meta = await pdf.getMetadata().catch(() => null);
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push(pageLines(content.items, i - 1, vp.height));
    page.cleanup();
    if (i % 5 === 0 || i === pdf.numPages) onProgress(i / pdf.numPages);
  }
  const outline = await resolveOutline(pdf);
  const info = meta?.info || {};
  await pdf.destroy();
  return buildBook({ pages, outline, metaTitle: info.Title, metaAuthor: info.Author, fileName });
}
