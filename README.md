# PulseLog (Fitness-App)

Mobile-first workout logging Progressive Web App built with Next.js + TypeScript + Tailwind.

## Features
- Bottom-tab mobile layout: Exercises, Templates, Log, History, Settings.
- Exercises library with local IndexedDB seed, search, filter chips, and detail modal.
- Template CRUD with add/remove exercise and drag-and-drop reorder via touch-friendly `@dnd-kit` sensors.
- Local-only data persistence using Dexie (IndexedDB).
- Dark mode toggle.
- Installable PWA (`manifest.webmanifest` + service worker + standalone display mode).

## Dataset
- `data/exercises.json` is a vendored permissive exercise dataset file for local seeding on first app launch.
- The app seeds records once into IndexedDB and tracks seed state in a metadata table.

## Local run steps
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000`.

## Build and verify
```bash
npm run lint
npm run build
```

## Android install/testing (Chrome)
1. Run the app with `npm run dev` (or production via `npm run build && npm run start`).
2. Open the app URL in Android Chrome (same network if testing from phone).
3. Tap Chrome menu (`⋮`) → **Add to Home screen** (or **Install app** prompt).
4. Launch the installed app icon; verify it opens in standalone mode (no browser chrome).
5. In app, confirm:
   - Exercise search and filters update results.
   - Template creation works.
   - Drag handle reorder works via touch.
   - Data persists after closing/reopening app.
