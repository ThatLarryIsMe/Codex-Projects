# BirdDriving 🐦🚗

A road-trip bird hunt for the whole car. The map follows you as you drive and shows which birds live in the area you're passing through. When you cross into new bird country, a reveal card deals out the birds to watch for. Tap a bird to learn about it, then press **I spotted it!** to score points against your crew and everyone else on the road.

## Features

- **Live map**: follows your GPS position, draws your route, and pins every bird you spot.
- **Local bird lists**: species seen within about 25 miles, from recent research-grade iNaturalist sightings. With no signal, it falls back to a built-in field guide of 48 roadside birds covering North American regions.
- **New-area reveals**: the map is split into roughly 35-mile areas. Entering a new one shows its name and three birds to look for, with a chirp.
- **Bird songs**: a "Hear its call" button plays a Creative Commons recording from iNaturalist.
- **Trip card**: the Journal makes a shareable 1080×1350 image with your route, stats, best find and crew podium.
- **Bird cards**: photos, rarity (1/3/5 points), a kid fact, a "where to look from the car" tip, a size comparison, and a description.
- **Spotting**: choose everyone in the car who saw it. You get confetti, a birdsong chirp, and an Undo button.
- **Leaderboards**: per area and for the whole trip. Your car always has one. Deployed on Vercel with Blob storage, or run with `server.js`, everyone on the road shares a board too.
- **Road Trip Bingo**: a 3×3 card for each area with a free car square in the middle.
- **Journal**: species, points, areas and miles, plus 10 badges and a trip log.
- **Kid mode**: bigger cards, fun facts first, no Latin names.
- **Demo drive**: a simulated drive from LA to Utah, for trying the app from your couch.
- **Offline-friendly PWA**: installable. Map tiles, photos and area lists are cached as you drive.

## Deploy to Vercel (shared leaderboards included)

1. Go to vercel.com/new, import **ThatLarryIsMe/Codex-Projects**, and set **Root Directory** to `birddriving`. Leave the framework as "Other" and don't set a build command. Click **Deploy**.
2. In the new project, open **Storage → Create → Blob** and connect the store to the project. This adds the `BLOB_READ_WRITE_TOKEN` setting the leaderboard needs.
3. Go to **Deployments → ⋯ → Redeploy** so the leaderboard picks up the storage connection.

Check it: `https://<your-app>.vercel.app/api/health` should return `{"ok":true}`. If it shows `false`, the Blob store isn't connected yet, and the app falls back to boards that stay on each phone.

To make the site update on every push, set **Settings → Git → Production Branch** to the branch you deploy from.

## Run it

```bash
cd birddriving
node server.js          # http://localhost:8080  (PORT=xxxx to change)
```

`server.js` is the self-hosted option (Node 18+, no dependencies needed). It serves the app and stores shared leaderboards in `data/leaderboard.json`. You can also host the folder on any static host. The app still works there, but leaderboards stay on each device.

Browsers only allow location and install on **HTTPS** (or localhost). To test on a phone, deploy behind HTTPS or use a tunnel.

## Data sources

- Birds near you: [iNaturalist](https://www.inaturalist.org) API (no key needed)
- Photos and descriptions: iNaturalist and Wikipedia / Wikimedia Commons (credited in the app)
- Place names: BigDataCloud reverse geocoding (free client endpoint)
- Map: © OpenStreetMap contributors, © CARTO. Map library: Leaflet 1.9.4 (vendored)

## Safety

The app tells people during setup and in the spotting dialog: **passengers spot, drivers drive.**
