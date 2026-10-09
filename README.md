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

1. **Overview:** Read store status, a recommended action, observed entry and exit counts, shelf condition, and recent signals. It does not duplicate the video analyzer.
2. **Entry & Exit:** Choose one of the two doorway recordings. Selection loads that exact clip automatically; press **Start Analysis**. Temporary anonymous visit records appear for observed entrance crossings and disappear after a matching exit or a two-minute timeout. Zone positions are estimates, and these sample clips may not show a matched exit.
3. **Shelf Maintenance:** Choose one of the local shelf recordings, then press **Start Analysis**. The middle-shelf restocking clip includes automatic empty/stocked calibration. Other clips need reference frames for an occupancy estimate. Set the low-stock percentage on this page, then inspect shelf events, evidence, and recommended actions. **Run sample shelf scenario** is a labeled simulation.

The recording selector and queue on each page show only videos for that use case. Switching pages reloads the last selected video for that page from the start. Only one video is analyzed at a time; switching pages stops the current analysis.

## Recordings

The page lists only recordings actually present in `public/recordings`. Two public demonstration clips are included in Git: [grocery entrance](https://www.pexels.com/video/people-going-inside-a-store-with-automatic-sliding-doors-6641527/) and [revolving building door](https://www.pexels.com/video/people-walking-passing-through-a-revolving-glass-door-4077491/), both from Pexels under its [free-use license](https://www.pexels.com/license/). These are sample videos, not proof that the same person enters and exits. The ten local shelf recordings are excluded from Git. Their labels describe the visible content; short reference clips are marked as such. You can also upload MP4/WebM files on the relevant use-case page; selected files stay in the browser session. No raw frames are posted to `/api/events` or `/api/visits`.

## What the model can and cannot do

The bundled [TensorFlow COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) model detects generic people and objects locally in the browser. It does not recognize faces, identify shoppers, recognize SKUs, or verify purchases. Person tracks are temporary in-memory coordinates that expire. Entrance footfall, queue count, and dwell are derived from detected boxes plus configured zones. Shelf occupancy is a calibrated image comparison against empty and stocked reference frames; a product-removal or restock event is an inferred shelf change, not a verified item identity. Low and empty signals use configured thresholds. The synthetic demo is labeled SIMULATED throughout.

Frames, detector boxes, temporary track IDs, heatmap coordinates, and reference images remain in browser memory. The local Node receiver accepts an exact allowlist of anonymous fields and rejects extra fields. Visit records contain only a random visit token and entry time in server memory. They are deleted on a matched exit, reset, or after a two-minute timeout; restarting the server clears them. The receiver listens on loopback and stores only bounded in-memory events. This is a prototype privacy boundary, not a production security audit. Temporary box tracking may lose a person during occlusion, so the exit count depends on continuous tracking and correctly placed zones. The recordings themselves are raw video, so publish only consent-cleared footage.

## Build and tests

`npm test` runs the unit and receiver tests. The committed browser model bundle runs without installing dependencies. To rebuild it after changing `public/model-entry.mjs`, run `npm install` and `npm run build:model`.

The active app lives in `public/index.html`, `public/retail.css`, `public/retail-app.mjs`, and `public/retail-core.mjs`; `server.mjs` serves the local UI, approved model assets, included recordings, and the event API. `public/contract.mjs` is the shared privacy schema. The earlier shelf-only implementation remains in `public/app.mjs` and `public/styles.css` for reference.

