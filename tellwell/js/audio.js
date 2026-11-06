// MP3 frame utilities. Each narration chunk is normalized so it can be played
// back to back with its neighbours (or joined into one file for export):
//  - ID3 tags and the encoder's Xing/Info/VBRI header frame are removed
//    (a stale Info frame makes players think the audio is shorter than it is);
//  - the pause that should follow the chunk is appended as real silent frames,
//    so playback never depends on timers (which a locked phone suspends);
//  - duration is computed exactly by counting frames.

const BR = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function header(b, i) {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const ver = (b[i + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
  const layer = (b[i + 1] >> 1) & 3; // 1 = Layer III
  const bri = (b[i + 2] >> 4) & 15;
  const sri = (b[i + 2] >> 2) & 3;
  if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) return null;
  const mpeg1 = ver === 3;
  const bitrate = BR[mpeg1 ? 1 : 2][bri] * 1000;
  const sampleRate = SR[ver][sri];
  const pad = (b[i + 2] >> 1) & 1;
  const mono = ((b[i + 3] >> 6) & 3) === 3;
  const len = Math.floor(((mpeg1 ? 144 : 72) * bitrate) / sampleRate) + pad;
  return {
    len,
    samples: mpeg1 ? 1152 : 576,
    sampleRate,
    side: mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17,
    crc: (b[i + 1] & 1) === 0,
  };
}

function skipId3(b) {
  if (b.length > 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
    const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
    return 10 + size + (b[5] & 0x10 ? 10 : 0);
  }
  return 0;
}

const tagAt = (b, i, s) => i + 4 <= b.length && String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]) === s;

// Returns null if the bytes are not a parseable Layer III stream.
export function parseMp3(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let i = skipId3(b);
  // Find the first frame whose successor is also a frame (avoids false syncs).
  let first = null;
  for (let tries = 0; i < b.length - 4 && tries < 65536; i++, tries++) {
    const h = header(b, i);
    if (h && (i + h.len >= b.length - 4 || header(b, i + h.len))) {
      first = h;
      break;
    }
  }
  if (!first) return null;

  const frames = [];
  let samples = 0;
  let firstIdx = i;
  while (i < b.length - 4) {
    const h = header(b, i);
    if (!h || i + h.len > b.length) break;
    if (i === firstIdx) {
      const off = i + 4 + (h.crc ? 2 : 0) + h.side;
      if (tagAt(b, off, "Xing") || tagAt(b, off, "Info") || tagAt(b, i + 36, "VBRI")) {
        i += h.len;
        firstIdx = i;
        continue;
      }
    }
    frames.push([i, h.len]);
    samples += h.samples;
    i += h.len;
  }
  if (!frames.length) return null;
  const start = frames[0][0];
  const end = frames[frames.length - 1][0] + frames[frames.length - 1][1];
  return {
    data: b.subarray(start, end),
    duration: samples / first.sampleRate,
    sampleRate: first.sampleRate,
    samplesPerFrame: first.samples,
    template: b.slice(start, start + 4),
  };
}

// Silent frames with the same format as the stream: header, then zeros
// (main_data_begin = 0, part2_3_length = 0 → the decoder outputs silence).
export function silence(template, sampleRate, samplesPerFrame, ms) {
  const hdr = Uint8Array.from(template);
  hdr[1] |= 1; // no CRC
  hdr[2] &= ~2; // no padding
  const h = header(hdr, 0);
  const count = Math.round((ms / 1000) * (sampleRate / samplesPerFrame));
  const out = new Uint8Array(h.len * count);
  for (let k = 0; k < count; k++) out.set(hdr, k * h.len);
  return { bytes: out, duration: (count * samplesPerFrame) / sampleRate };
}

// Normalize one chunk's audio and append its trailing pause.
export async function prepareChunk(arrayBuffer, type, pauseMs) {
  const parsed = /mpeg|mp3/.test(type) ? parseMp3(arrayBuffer) : null;
  if (parsed) {
    const tail = pauseMs > 0 ? silence(parsed.template, parsed.sampleRate, parsed.samplesPerFrame, pauseMs) : { bytes: new Uint8Array(0), duration: 0 };
    const blob = new Blob([parsed.data, tail.bytes], { type: "audio/mpeg" });
    return { blob, duration: parsed.duration + tail.duration };
  }
  // Unknown format: keep as-is and measure by decoding.
  const blob = new Blob([arrayBuffer], { type: type || "audio/mpeg" });
  let duration = 0;
  try {
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const buf = await new Ctx(1, 1, 44100).decodeAudioData(arrayBuffer.slice(0));
    duration = buf.duration;
  } catch {
    duration = await new Promise((resolve) => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => resolve(0);
      a.src = URL.createObjectURL(blob);
    });
  }
  return { blob, duration };
}
