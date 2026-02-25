# PR Summary

## Overview
- Improved PWA update reliability by bumping the service worker cache version and replacing the always-cache-first behavior with targeted stale-while-revalidate + network-first strategies.
- Upgraded Log tab exercise adding flow from a large `<select>` to a touch-friendly modal picker with search plus equipment/body-part chips.
- Polished set logging UX with per-row **Remove set** action and stricter numeric input handling to prevent negative values.
- Hardened active workout restore path by safely handling corrupted `active_workout` JSON in IndexedDB.
- Reduced accidental drag interactions on touch devices by adding dnd-kit activation constraints.
- Updated history summary counting so only sets with valid numeric weight/reps contribute to set count and volume.

## Screens added/changed
- **Log tab**
  - Replaced “Add exercise from library” select with modal picker.
  - Added search field and equipment/body-part filter chips inside modal.
  - Added set-row trash button to remove individual sets.
  - Improved touch scroll behavior by reducing accidental drag starts.

## Data/storage changes
- Service worker cache key changed from `pulselog-v1` to `pulselog-v2` to force clean cache turnover.
- Active workout restore now catches JSON parse failures and clears bad `active_workout` meta key.

## How to run
1. `npm install`
2. `npm run dev`
3. Open `http://localhost:3000`
4. Optional checks: `npm run lint` and `npm run build`

## What to test (step-by-step)
1. **Service worker update behavior**
   - Start app and verify install works as before.
   - Make a code change/build update, then verify navigation requests prefer fresh network content.
   - Verify app shell assets can still load from cache when offline.
   - If stale content appears, hard refresh and/or uninstall + reinstall the PWA to force fresh worker/cache usage.
2. **New exercise picker in Log tab**
   - Start a quick workout.
   - Tap **Add exercise from library…** and verify modal opens.
   - Search by name and filter by equipment/body part chips.
   - Tap an exercise and verify it is added and modal closes.
3. **Set logging polish**
   - Add multiple sets and remove one via trash button.
   - Verify negative input attempts for weight/reps are rejected.
4. **History summary**
   - Log a mix of valid and invalid/blank sets.
   - Finish workout and verify set count/volume include only valid numeric sets.
5. **Robustness checks**
   - Manually corrupt `active_workout` in IndexedDB meta and reload.
   - Verify app no longer crashes and clears the bad entry.

## Known issues / TODO
- History summary currently counts all valid numeric sets regardless of completion checkbox state.
- Non-shell static assets still use fallback cache-first strategy (intentionally minimal for this PR).
