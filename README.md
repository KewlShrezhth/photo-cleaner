# Photo Cleaner

Finds groups of near-duplicate photos on your phone, keeps the best shot in each group, and moves the rest to a "Photo Cleaner Archive" album. Nothing is deleted.

- `app/` is the Expo (React Native) app. It picks photos by date range or place, sends small thumbnails to the server, and shows the groups it gets back.
- `server/` is a small Node server. It groups photos with CLIP embeddings, scores sharpness and exposure locally, and asks Claude only to break close calls. It works without an API key; you just get the free scoring.

## Requirements

- Node.js 20.6 or newer (the server uses `node --env-file`)
- A phone, Android emulator or iOS simulator to run the Expo app

## 1. Run the server

```bash
cd server
npm install
cp .env.example .env   # then edit it
npm start
```

`.env` settings:

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | Optional. Without it, close calls are decided by the local scores only. |
| `MODEL` | `claude-haiku-5-5` | Claude model used for close calls. |
| `PORT` | `8787` | Port the server listens on (all interfaces). |

The first request downloads the CLIP model, so it is slower than the rest.

## 2. Run the app

```bash
cd app
npm install
EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:8787 npx expo start
```

`EXPO_PUBLIC_API_URL` tells the app where the server is. It is read when the bundle is built, so restart `expo start` after changing it. You can also put it in `app/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:8787
```

If it is not set, the app uses `http://10.0.2.2:8787`, which only works from the Android emulator (that address points to the host computer). On a real phone, use your computer's LAN address and make sure the phone is on the same network and your firewall allows the port.

## Demo mode (optional)

In development builds the app can show a "Try with sample photos" button that runs every screen without photo-library access or the server. It needs 12 images at `app/assets/samples/s00.jpg` to `s11.jpg` (4 scenes of 3 shots each, see `app/src/samples.ts`). These files are gitignored and not in the repository; without them the app still builds and the demo button is simply hidden.
