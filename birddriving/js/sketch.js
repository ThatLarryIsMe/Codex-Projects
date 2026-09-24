// Illustrated fallback portrait, drawn from a bird's palette, shown while a
// photo loads or when there is no signal. Deterministic per bird.
const PALETTES = [
  ["#6b8f71", "#4f6f55", "#80a086", "#e8dcc4", "#e0a526"],
  ["#8a6b52", "#6d523e", "#9b7a60", "#efe1cc", "#3a3a3a"],
  ["#50739b", "#3e5d82", "#5f85ad", "#e7e3da", "#2a2a2a"],
];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function sketchSvg(bird) {
  const h = hash(bird.key || bird.name || "bird");
  const [body, wing, head, belly, beak] = bird.colors || PALETTES[h % PALETTES.length];
  const skyA = ["#ffe7c2", "#d9f0ea", "#e4e9ff", "#ffe0e0"][h % 4];
  const skyB = ["#ffc58f", "#a8dccf", "#bcc8ff", "#ffc0c0"][h % 4];
  const long = bird.group === "water" && (bird.size === "eagle" || bird.size === "goose");
  const neck = long ? `<path d="M118 92 C 124 70, 132 56, 140 50" stroke="${head}" stroke-width="14" fill="none" stroke-linecap="round"/>` : "";
  const hx = long ? 142 : 128;
  const hy = long ? 46 : 70;
  const gid = `g${h}`;
  return `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustration of ${bird.name}">
  <defs><radialGradient id="${gid}" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${skyA}"/><stop offset="1" stop-color="${skyB}"/></radialGradient></defs>
  <rect width="200" height="160" fill="url(#${gid})"/>
  <circle cx="160" cy="34" r="16" fill="#fff6d8" opacity=".85"/>
  <path d="M0 132 Q 50 118 100 128 T 200 124 V160 H0Z" fill="#000" opacity=".08"/>
  <path d="M20 128 H180" stroke="#4a3b2c" stroke-width="5" stroke-linecap="round"/>
  <path d="M64 102 L 26 124 L 40 126 L 70 112Z" fill="${wing}"/>
  <ellipse cx="96" cy="100" rx="40" ry="26" fill="${body}"/>
  <ellipse cx="104" cy="110" rx="26" ry="14" fill="${belly}"/>
  <path d="M70 92 C 86 82, 114 86, 120 100 C 104 104, 84 106, 66 104Z" fill="${wing}" opacity=".95"/>
  ${neck}
  <circle cx="${hx}" cy="${hy}" r="17" fill="${head}"/>
  <path d="M${hx + 14} ${hy - 3} L ${hx + (long ? 44 : 30)} ${hy + 2} L ${hx + 14} ${hy + 7}Z" fill="${beak}"/>
  <circle cx="${hx + 5}" cy="${hy - 3}" r="4.2" fill="#fff"/>
  <circle cx="${hx + 6}" cy="${hy - 3}" r="2.4" fill="#111"/>
  <path d="M92 124 v6 M104 124 v6" stroke="#4a3b2c" stroke-width="3" stroke-linecap="round"/>
</svg>`;
}

export function sketchDataUri(bird) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sketchSvg(bird))}`;
}
