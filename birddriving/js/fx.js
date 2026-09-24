// Celebration effects: feather confetti and a synthesized birdsong chirp.
let audioCtx = null;

export function chirp(kind = "spot") {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    // A spot is two quick rising chirps; a new area is a descending three-note call.
    const notes =
      kind === "area"
        ? [[2600, 3400, 0], [2200, 3000, 0.16], [1800, 2600, 0.32]]
        : kind === "bingo"
        ? [[1800, 3600, 0], [2000, 3800, 0.12], [2200, 4200, 0.24], [2600, 4600, 0.36]]
        : [[2400, 4200, 0], [2800, 4600, 0.13]];
    for (const [from, to, at] of notes) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(from, now + at);
      osc.frequency.exponentialRampToValueAtTime(to, now + at + 0.09);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.11);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.12);
    }
  } catch {
    // Audio is a nicety; ignore browsers that block it.
  }
}

export function confetti(originEl, colors = ["#ff7a45", "#ffc857", "#2bb3a3", "#6c63ff", "#e84a7f"]) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const r = originEl?.getBoundingClientRect?.();
  const ox = r ? r.left + r.width / 2 : innerWidth / 2;
  const oy = r ? r.top + r.height / 2 : innerHeight / 2;
  const parts = Array.from({ length: 70 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const v = 6 + Math.random() * 8;
    return {
      x: ox, y: oy,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      size: 7 + Math.random() * 9,
      color: colors[i % colors.length],
      feather: i % 3 === 0,
    };
  });
  const start = performance.now();
  function frame(t) {
    const age = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.28;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx + Math.sin((age + p.size * 40) / 180) * (p.feather ? 1.4 : 0.4);
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / 1800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.feather) {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.35, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.7)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(0, p.size);
        ctx.stroke();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }
    if (age < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

export function vibrate(pattern = 30) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported.
  }
}
