# StageDock

StageDock is a desktop application for Windows built with Electron, Next.js (React 18), and TypeScript. It helps power viewers keep track of their favourite Twitch and YouTube channels, launch multi-view layouts, and control audio balances from a single surface.

## Requirements

- Node.js 22 LTS
- npm 10 (ships with Node 22)
- Windows 10/11 (primary target)
- Twitch Client ID/Secret (optional but required for live polling)
- YouTube Data API v3 key (optional but required for live polling)

## Getting started

```bash
# install dependencies
npm install

# start the renderer + electron dev environment
npm run dev
```

The development script launches:

- `next dev ./renderer` (renderer UI)
- TypeScript compiler in watch mode for the main/preload code
- Electron with context isolation enabled

## Project structure

```
├─ dist/                     # build output (main, preload, renderer)
├─ renderer/                 # Next.js app (Tailwind + React Query)
│  ├─ app/                   # App router routes
│  ├─ components/            # Shared UI components
│  ├─ hooks/                 # React Query hooks for IPC calls
│  └─ lib/                   # Client helpers
├─ src/
│  ├─ common/                # Shared types + IPC names
│  ├─ main/                  # Electron main process
│  │  ├─ database/           # SQLite/Zod schema + helpers
│  │  ├─ services/           # Background services (monitoring, sync)
│  │  └─ ...                 # Entry point (index.ts)
│  └─ preload/               # Safe IPC bridge
└─ scripts/                  # Build helpers (copy renderer output)
```

## Background services

- **Live monitor**: polls Twitch/YouTube APIs (via `undici`) and persists status updates in SQLite. Notifications are triggered when a creator transitions from offline to live and notifications are enabled.
- **Notification service**: wraps Electron's `Notification` API to show actionable toasts.
- **Sync service (prototype)**: WebSocket relay that broadcasts basic playback commands across subscribers in the same room.

## Manual verification checklist

1. **Database & persistence**
   - run `npm run dev`
   - add Twitch/YouTube entries on the Favorites screen and confirm they persist after reload
2. **Live monitoring**
   - provide valid API credentials
   - wait for the background poller (1 min) and verify live status badges update
   - toggle notifications and check that Windows toast appears when a creator goes live
3. **Multi-view**
   - paste multiple embed URLs and render
   - save the layout, reload the app, and restore the saved set
   - drag the volume sliders on the Mixer page (streams should sync via the custom event bridge)
4. **Packaging**
   - run `npm run build` to produce `dist/` output plus exported renderer assets

## Future work

- Integrate WASAPI/PortAudio audio backend and honour solo/mute commands.
- Harden Twitch/YouTube API error handling with retries and rate-limit backoff.
- Add OAuth login to retrieve channel lists automatically.
- Wire the sync service into renderer components for collaborative playback control.
