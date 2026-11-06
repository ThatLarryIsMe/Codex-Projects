// Voice catalog, narration styles and cost estimates.

export const PROVIDERS = {
  elevenlabs: {
    name: "ElevenLabs",
    blurb: "The most human-sounding narration available. Chunks are stitched together so each chapter reads as one continuous performance.",
    keyHint: "elevenlabs.io → Profile → API Keys",
    chunkChars: 1800,
    models: [
      { id: "eleven_multilingual_v2", name: "Multilingual v2", note: "Richest, most consistent for long-form. 1 credit per character.", creditsPerChar: 1 },
      { id: "eleven_flash_v2_5", name: "Flash v2.5", note: "Half the credits, slightly flatter delivery.", creditsPerChar: 0.5 },
    ],
    voices: [
      { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", tag: "Warm British storyteller", gender: "m", best: "Fiction, classics" },
      { id: "nPczCjzI2devNBz1zQrb", name: "Brian", tag: "Deep, resonant American", gender: "m", best: "Thrillers, history" },
      { id: "pqHfZKP75CyOlMrTvMVp", name: "Bill", tag: "Seasoned, trustworthy American", gender: "m", best: "Nonfiction, memoir" },
      { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", tag: "Composed British, authoritative", gender: "m", best: "Nonfiction, business" },
      { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", tag: "Velvety British", gender: "f", best: "Literary fiction, romance" },
      { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", tag: "Warm, friendly American", gender: "f", best: "Memoir, YA, self-help" },
      { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", tag: "Clear, confident British", gender: "f", best: "Nonfiction, education" },
      { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", tag: "Soft, reassuring American", gender: "f", best: "Contemporary fiction, devotional" },
    ],
  },
  openai: {
    name: "OpenAI",
    blurb: "Very affordable and takes direction: the narration style below is sent with every passage. Roughly $0.015 per minute of audio.",
    keyHint: "platform.openai.com → API keys",
    chunkChars: 1400,
    models: [{ id: "gpt-4o-mini-tts", name: "GPT-4o mini TTS", note: "Steerable narration. ≈ $0.015 per minute of audio.", dollarsPerMinute: 0.015 }],
    voices: [
      { id: "cedar", name: "Cedar", tag: "Natural, grounded male", gender: "m", best: "Fiction, nonfiction" },
      { id: "marin", name: "Marin", tag: "Natural, bright female", gender: "f", best: "Contemporary, memoir" },
      { id: "fable", name: "Fable", tag: "Expressive British storyteller", gender: "m", best: "Fantasy, children's" },
      { id: "onyx", name: "Onyx", tag: "Deep, steady male", gender: "m", best: "Thrillers, history" },
      { id: "ballad", name: "Ballad", tag: "Warm, emotive male", gender: "m", best: "Literary fiction, poetry" },
      { id: "sage", name: "Sage", tag: "Calm, thoughtful female", gender: "f", best: "Nonfiction, devotional" },
      { id: "coral", name: "Coral", tag: "Warm, lively female", gender: "f", best: "YA, romance" },
    ],
  },
};

// A narration style shapes the read on both providers: it becomes the
// performance direction for OpenAI and tunes ElevenLabs' expressiveness.
const BASE =
  "You are a professional audiobook narrator recording an unabridged book. Read exactly the text given, word for word. " +
  "Use a natural, unhurried pace, breathe at punctuation, and let a paragraph end settle before moving on. " +
  "Voice dialogue with light, believable shifts in tone rather than caricatured character voices. " +
  "Keep volume, pitch and energy consistent with the passage that came before.";

export const STYLES = [
  { id: "literary", name: "Literary", note: "Warm, intimate, reflective", stability: 0.5, exaggeration: 0.1, direction: `${BASE} Tone: warm and intimate, as if reading to one listener by lamplight. Savor imagery; let emotional beats land.` },
  { id: "suspense", name: "Suspense", note: "Taut, controlled tension", stability: 0.42, exaggeration: 0.2, direction: `${BASE} Tone: low and controlled, with quiet tension. Tighten the pace in action; hold pauses before reveals.` },
  { id: "nonfiction", name: "Nonfiction", note: "Clear, engaged, confident", stability: 0.6, exaggeration: 0.05, direction: `${BASE} Tone: clear, confident and genuinely interested, like a thoughtful lecturer. Emphasize key ideas; make lists easy to follow.` },
  { id: "classic", name: "Classic", note: "Measured, elegant, formal", stability: 0.62, exaggeration: 0.05, direction: `${BASE} Tone: measured and elegant, suited to older prose. Give long sentences room so their structure stays clear.` },
  { id: "spiritual", name: "Devotional", note: "Calm, reverent, steady", stability: 0.7, exaggeration: 0, direction: `${BASE} Tone: calm, reverent and steady. Unhurried, with space for reflection; never theatrical.` },
  { id: "children", name: "Children's", note: "Bright, playful, expressive", stability: 0.35, exaggeration: 0.3, direction: `${BASE} Tone: bright, playful and expressive, reading aloud to a child at bedtime. Give characters distinct but gentle voices.` },
];

export const QUALITY = [
  { id: "mp3_44100_64", name: "Standard", note: "64 kbps · ~29 MB per hour · audiobook-store quality" },
  { id: "mp3_44100_128", name: "High", note: "128 kbps · ~58 MB per hour" },
];

export const SAMPLE =
  "The rain had stopped by the time she reached the harbor. For a long moment she stood at the water's edge, listening to the boats knock gently against the pier. \"You came back,\" he said quietly. She didn't turn around. \"I said I would.\"";

export const WORDS_PER_MINUTE = 155;

export function estimate(chars, words, provider, modelId) {
  const minutes = words / WORDS_PER_MINUTE;
  const p = PROVIDERS[provider];
  const model = p?.models.find((m) => m.id === modelId) || p?.models[0];
  let cost = "";
  if (model?.creditsPerChar) cost = `≈ ${Math.round(chars * model.creditsPerChar).toLocaleString()} ElevenLabs credits`;
  else if (model?.dollarsPerMinute) cost = `≈ $${(minutes * model.dollarsPerMinute).toFixed(2)} in OpenAI usage`;
  return { minutes, cost };
}

export function fmtDuration(minutes) {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function voiceName(provider, id, custom = []) {
  const v = PROVIDERS[provider]?.voices.find((x) => x.id === id) || custom.find((x) => x.id === id);
  return v ? v.name : id;
}
