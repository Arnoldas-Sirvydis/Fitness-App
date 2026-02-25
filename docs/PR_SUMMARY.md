# PR Summary

## Overview
- Implemented a full active workout flow that can be started from templates (new **Start** button) or from the Log tab using a template picker / quick workout option.
- Replaced placeholder Log tab with a functional workout logger:
  - Exercise cards with touch-friendly drag handles for reorder.
  - Set table per exercise (Set #, Weight, Reps, Completed).
  - Actions for **Add set**, **Copy last set**, **Add exercise from library**, and **Remove exercise**.
  - **Finish workout** persists the workout and clears active session state.
- Added Dexie persistence for workout history and active session restore:
  - New `workouts` table to store completed workouts.
  - Active in-progress workout is persisted in `meta` and restored across refresh.
- Replaced placeholder History tab with workout history UX:
  - Newest-first list of completed workouts.
  - Summary per workout (exercise count, total sets, total volume).
  - Workout details modal with exercises and sets.
  - Delete workflow with confirmation dialog.
- Enhanced Settings with a persisted weight unit toggle (`kg`/`lb`) and wired unit labels through logging/history details.

## Screens added/changed
- **Templates tab**
  - Added Start button for each template.
- **Log tab**
  - Added start workout picker + quick start.
  - Added active workout logging interface.
- **History tab**
  - Added completed workout list with detail modal and delete action.
- **Settings tab**
  - Added persisted weight unit selector.

## Data/storage changes
- Dexie schema updated with a new table:
  - `workouts: '++id, startedAt, endedAt'`
- `meta` keys now include:
  - `active_workout` (serialized in-progress session)
  - `weight_unit` (`kg` or `lb`)
  - `dark_mode` (`true`/`false`)

## How to run
1. `npm install`
2. `npm run dev`
3. Open `http://localhost:3000`
4. Optional validation: `npm run lint` and `npm run build`

## What to test (step-by-step)
1. Go to **Templates**, create/edit a template, and tap **Start**.
2. Verify app switches to **Log** with active workout visible.
3. In Log:
   - Add and edit sets (weight/reps/check complete).
   - Use **Copy last set**.
   - Add and remove exercises.
   - Drag exercises to reorder.
4. Refresh page during an active workout and confirm session is restored.
5. Tap **Finish workout** and verify redirect to **History**.
6. In History:
   - Confirm newest-first ordering.
   - Open an item to view set details.
   - Delete an item and confirm it disappears.
7. In Settings, switch units between **kg/lb** and verify labels update in Log + History.

## Known issues / TODO
- Volume summary is based on numeric `weight × reps` inputs and ignores non-numeric values.
- History detail currently uses a modal and does not yet support editing completed workouts.
