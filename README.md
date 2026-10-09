# ShelfSentinel

A privacy-first retail analytics prototype for the Flo 2026 hackathon. One local video session powers shelf observations, temporary person detection, anonymous operational events, evidence, metrics, and recommended actions.

## Run

Node.js 20+ is required. The model bundle and weights are included, so running the app needs no cloud model download or API key.

```powershell
cd "C:\Users\shierenkhan\Downloads\Personal\Privacy hacthone\shelfsentinel"
npm start
```

Open http://127.0.0.1:8787/ . If that port is occupied, set `$env:PORT='8790'` before starting and open the matching address. Run `npm test` for the privacy, shelf, API, tracking, and event-rule tests.

## Use the product

1. **Overview:** Monitor the store feed, shelf status, active anonymous visits, activity, and recommended action.
2. **Video sources:** The local 21-second restocking recording is preloaded when present. Press **Start Analysis**. The first load may take a few seconds while the bundled model initializes. Alternatively press **Run guided demo** for a clearly labeled simulated shelf.
3. **Visits:** Load the included grocery entrance sample, start analysis, and watch anonymous visit records appear when a tracked person crosses the entrance zone. A matching exit-zone crossing deletes the record. A record also expires after two minutes if an exit cannot be observed. The included zones are estimates; adjust them to the doorway for reliable counts.
4. **Store Zones:** Draw a rectangle to configure a shelf, queue, entrance, exit, promotion, or ignored area. Shelf estimates require an empty and a stocked reference. The included restocking clip prepares these automatically; other footage needs manual captures.
4. **Event Stream:** Select a row to inspect its video time, detected evidence, rule, confidence, privacy result, delivery status, and recommended action.
5. **Privacy Inspector:** Compare the local frame with the exact outbound JSON. The JSON contains only an event type, shelf identifier, time, zone name, confidence, and value. The forbidden-payload probe demonstrates local rejection.
6. **Operations and Insights & Actions:** Read metrics from the active session and open an action's evidence. Missing observations show “Not available from current model.”
7. **System health:** Trigger a labeled failure simulation. Network and stream failures buffer validated events; privacy failure blocks them. Restore to flush buffered events.

## Recordings

The page lists only recordings actually present in `public/recordings`. Two public demonstration clips are included in Git: [grocery entrance](https://www.pexels.com/video/people-going-inside-a-store-with-automatic-sliding-doors-6641527/) and [building entrance/exit](https://www.pexels.com/video/people-walking-passing-through-a-revolving-glass-door-4077491/), both from Pexels under its [free-use license](https://www.pexels.com/license/). These are sample videos, not a calibrated store dataset or proof that the same person enters and exits. Other local recordings remain excluded from Git. You can also upload MP4/WebM files in Video Analysis; selected files stay in the browser session. No raw frames are posted to `/api/events` or `/api/visits`.

## What the model can and cannot do

The bundled [TensorFlow COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) model detects generic people and objects locally in the browser. It does not recognize faces, identify shoppers, recognize SKUs, or verify purchases. Person tracks are temporary in-memory coordinates that expire. Entrance footfall, queue count, and dwell are derived from detected boxes plus configured zones. Shelf occupancy is a calibrated image comparison against empty and stocked reference frames; a product-removal or restock event is an inferred shelf change, not a verified item identity. Low and empty signals use configured thresholds. The synthetic demo is labeled SIMULATED throughout.

Frames, detector boxes, temporary track IDs, heatmap coordinates, and reference images remain in browser memory. The local Node receiver accepts an exact allowlist of anonymous fields and rejects extra fields. Visit records contain only a random visit token and entry time in server memory. They are deleted on a matched exit, reset, or after a two-minute timeout; restarting the server clears them. The receiver listens on loopback and stores only bounded in-memory events. This is a prototype privacy boundary, not a production security audit. Temporary box tracking may lose a person during occlusion, so the exit count depends on continuous tracking and correctly placed zones. The recordings themselves are raw video, so publish only consent-cleared footage.

## Build and tests

`npm test` runs the unit and receiver tests. The committed browser model bundle runs without installing dependencies. To rebuild it after changing `public/model-entry.mjs`, run `npm install` and `npm run build:model`.

The active app lives in `public/index.html`, `public/retail.css`, `public/retail-app.mjs`, and `public/retail-core.mjs`; `server.mjs` serves the local UI, approved model assets, included recordings, and the event API. `public/contract.mjs` is the shared privacy schema. The earlier shelf-only implementation remains in `public/app.mjs` and `public/styles.css` for reference.

