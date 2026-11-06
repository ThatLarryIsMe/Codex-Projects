# Tellwell 📖🎧

Upload a PDF and get a naturally narrated audiobook you can listen to right in the app.

## How it works

1. **Reading the PDF** (in your browser with pdf.js, so the PDF is never uploaded anywhere)
   - Finds chapters from the PDF's bookmarks. If it has none, it uses chapter headings ("Chapter 3", "Prologue", large headings). If those are missing too, it splits the book into parts of about 30 minutes each.
   - Removes running headers, page numbers and footnotes. It rejoins words hyphenated across lines, reattaches drop caps, and rebuilds paragraphs.
   - Unticks the contents page, copyright, index and notes by default. You review the chapter list before anything is narrated: rename, merge, include or exclude.
2. **Narrating in chunks**
   - Each chapter is split at paragraph or sentence boundaries, about 1,800 characters per chunk for ElevenLabs and 1,400 for OpenAI. A chunk never cuts a sentence in half.
   - Every request carries context so tone and pacing stay consistent across a chapter. **OpenAI (default)** gets the narration direction plus the end of the previous passage. Each request is self-contained, so 4 passages are narrated at once, closest to where you're listening first. ElevenLabs (optional) chains each chunk to the audio before it (`previous_request_ids`, `previous_text`, `next_text`), so its chunks within a chapter go strictly in order.
   - Pauses are added as real silence after each chunk: a beat after the chapter title, a paragraph pause, a longer rest at scene breaks (`* * *`) and at the end of a chapter.
3. **Listening**
   - Playback starts as soon as the first passage is ready. Each chapter plays as one continuous track with a scrubber, skip back 15 s and forward 30 s, speed from 0.8× to 2× (pitch preserved), a sleep timer, and lock-screen and headphone controls.
   - Read-along text highlights the passage being spoken. Tap any paragraph to jump to it.
   - Audio is saved on the device (IndexedDB), so finished books play offline. Your place is remembered. You can download any chapter as an MP3.

### Voices

| Provider | Voices | Cost for a typical novel (≈ 90k words, 500k characters, ≈ 10 h) |
|---|---|---|
| **OpenAI** `gpt-4o-mini-tts` (**default**): natural, steerable, cheap | Cedar (default), Marin, Fable, Onyx, Ballad, Sage and Coral | ≈ $9 (about $0.90 per hour of audio) |
| ElevenLabs (optional premium) | George, Brian, Bill, Daniel, Lily, Matilda, Alice and Sarah, plus any voice in your account | ≈ 500k credits, which needs one of the pricier plans |

Narration styles (Literary, Suspense, Nonfiction, Classic, Devotional, Children's) set ElevenLabs' expressiveness and are sent to OpenAI as performance direction.

**About Block's Dessa:** Block announced Dessa on Oct 23, 2026. It is a research preview: there's no public API, weights or pricing, and it's a full-duplex speech-to-speech (conversational) model, not a text-to-speech narrator. Providers are adapters in `api/_providers.js`. If Block releases an API, add an entry there and its voices in `js/voices.js`.

## Deploy to Vercel

1. vercel.com/new → import this repo → **Root Directory: `tellwell`**. Framework "Other", no build command → Deploy.
2. **Settings → Environment Variables**:
   - `OPENAI_API_KEY` (from platform.openai.com → API keys; the account needs billing set up)
   - `ELEVENLABS_API_KEY` (optional)
   - `APP_PASSCODE` (**recommended** once keys are on the server, so strangers can't use your credits; the app asks for it once)
3. Redeploy. Check `https://<app>.vercel.app/api/health`.

You can skip the server keys and paste your own keys in the app's **Settings** instead. They're stored in that browser only.

On a phone, open the site and choose **Add to Home Screen** to get a full-screen app with lock-screen controls.

## Run locally

```bash
cd tellwell
OPENAI_API_KEY=... node server.js   # http://localhost:8080
MOCK_TTS=1 node server.js                                  # offline test mode: tones instead of voices (needs ffmpeg)
```

Node 18+, no dependencies.

## Things to know

- **Keep the app open while it narrates.** Narration runs in the page. It's faster than real time, but a full novel still takes a while, so you'll usually be listening to chapter 1 while later chapters are being narrated. Phones pause background tabs, so on a phone either keep the screen on (Tellwell asks the browser to stay awake while narrating) or narrate on a computer. Narration picks up where it stopped when you return.
- **Books live on the device that narrated them.** Narrate on the device you'll listen on. Syncing between devices would need server storage (e.g. Vercel Blob); it isn't built yet.
- **Storage:** about 29 MB per hour of audio at Standard quality. Tap *Keep my audiobooks* in Settings so the browser doesn't evict them.
- **Scanned PDFs** (page images with no text layer) need OCR first.

## Files

| Path | Role |
|---|---|
| `js/pdf-extract.js` | pdf.js → positioned lines, drop caps, footnote markers |
| `js/structure.js` | lines → paragraphs → chapters (headers/footers, hyphenation, TOC detection) |
| `js/chunker.js` | chapter → narration chunks with pauses |
| `js/generator.js` | ordered, stitched narration queue with retries |
| `js/audio.js` | MP3 frame tools: strip Xing/ID3, append silent frames, exact duration |
| `js/player.js` | gapless chunk playback, chapter timeline, Media Session |
| `js/app.js` | UI: library, review, player, settings |
| `api/` | Vercel functions: `tts`, `voices`, `health` (mirrored by `server.js`) |
