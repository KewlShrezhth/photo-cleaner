# Photo Cleaner

A mobile app that groups a day of photos into moments (the beach, dinner, the dog) and keeps the best shot of each. The extra shots move to an Archive album. Nothing is ever deleted.

Built with Expo (React Native) for Android and iPhone, with a small Node server for the image analysis.

## How it works

1. **Pick photos** by date range, by place, or by choosing them yourself.
2. **The server groups them by situation.** It uses CLIP image embeddings and average-linkage clustering, so similar shots of the same moment land together.
3. **It ranks each group** by sharpness (Laplacian variance) and exposure. For close calls it can ask Claude (Haiku) to judge faces and composition, if an API key is set.
4. **It keeps 1 to 3 per group**, depending on group size. You confirm, and the rest move to a "Photo Cleaner Archive" album. One-off photos that fit no group are left alone.

Only 384px thumbnails leave the phone, and the server keeps nothing. See the [privacy policy](https://kewlshrezhth.github.io/photo-cleaner/privacy.html).

## Project layout

```
app/      Expo app (App.tsx, src/)
server/   Node server: POST /analyze, GET /health
docs/     Privacy policy (GitHub Pages)
store/    Play Store listing text and graphics
```

## Run it locally

```bash
# server
cd server && npm install && node index.js         # http://localhost:8787

# app (Android emulator, dev build)
cd app && npm install && npx expo run:android
```

The app reaches the server at `http://10.0.2.2:8787` from the Android emulator. For a phone, set `EXPO_PUBLIC_API_URL` to the server's address.

## Server settings (environment variables)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Optional. Enables Claude judging for close calls. Without it, free scoring only. |
| `APP_KEY` | Optional. If set, requests need a matching `x-app-key` header (the app sends `EXPO_PUBLIC_APP_KEY`). |
| `PORT` | Default 8787. |

Deploy with the included `server/Dockerfile` (Railway, Fly.io or Render). Each IP is limited to 20 analyses per 10 minutes.

## Release builds

`app/eas.json` has `preview` (APK for testers) and `production` (Play Store AAB) profiles. Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_APP_KEY` as EAS environment variables, then run `eas build -p android --profile production`.
