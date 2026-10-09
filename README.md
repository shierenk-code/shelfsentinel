# ShelfSentinel

ShelfSentinel is a privacy-first store operations dashboard for the Flo 2026 hackathon. It helps staff estimate store presence, spot shelves that need attention, and respond to checkout congestion from video. Video analysis runs in the browser. The app keeps only limited, anonymous operational data in the local server's memory.

For the implementation, technology stack, processing stages, and privacy boundary, see [Architecture and technology stack](docs/ARCHITECTURE.md). For the presentation diagram and system flow, see [High-level architecture](docs/HIGH_LEVEL_ARCHITECTURE.md).

## The idea in one minute

A store camera can help staff react to busy entrances and low-stock shelves, but storing customer video or identifying shoppers creates a privacy problem. ShelfSentinel turns video into short-lived observations instead of customer profiles:

1. A staff member chooses a doorway, shelf, or checkout recording on its matching page and starts analysis.
2. The browser detects people and objects and checks configured zones.
3. **Entry & Exit** estimates arrivals, departures, and people inside. An observed arrival opens a temporary anonymous visit record. A matched departure deletes it; a missed departure expires after two minutes.
4. **Shelf Maintenance** estimates visible shelf occupancy and raises a low-stock signal against a staff-set limit. It shows the relevant moment in the video and a suggested action.
5. **Checkout Help** estimates people waiting in a marked queue area. Staff can mark when another checkout opens, then compare a later observed queue count. This is an observation, not proof of cause or an exact wait-time measurement.
6. **Overview** brings the latest store signals together so staff can decide where to look next.

**Example:** If a person crosses the entrance zone, the estimated inside count increases. If the same temporary track later crosses the exit zone, its visit record is removed. If a shelf drops below the chosen limit, the shelf page recommends checking or restocking it.

This is a working prototype, not a shopper identity system or an exact inventory counter. The included doorway clips do not establish a complete entry-to-exit journey, and most shelf clips need calibration before an occupancy estimate is meaningful.

## Run

Node.js 20+ is required. The model bundle and weights are included, so running the app needs no cloud model download or API key.

```powershell
cd "C:\Users\shierenkhan\Downloads\Personal\Privacy hacthone\shelfsentinel"
npm start
```

Open http://127.0.0.1:8787/ . If that port is occupied, set `$env:PORT='8790'` before starting and open the matching address. Run `npm test` for the privacy, shelf, API, tracking, and event-rule tests.

## Use the product

1. **Overview:** See the store name and date, estimated people inside, observed entries and exits, active anonymous records, and the last measured shelf condition. This page is a summary without a video analyzer.
2. **Entry & Exit:** Choose one of the three doorway recordings and press **Start Analysis**. The new clothing-store clip visibly shows shoppers leaving. Its exit-only observations appear in the table without reducing the people-inside count, because no matching entry was recorded in that separate clip. A matched exit from a continuous track deletes its active server record; otherwise, an active record expires after two minutes. Zone positions are estimates.
3. **Shelf Maintenance:** Choose a shelf recording and press **Start Analysis**. One video view shows the footage. The activity table logs visual changes in the monitored shelf area. Visible stock, empty space, and restock/low-stock claims appear only after calibration. The middle-shelf restocking clip calibrates automatically. For another camera angle, expand **Calibrate a different shelf video**, seek on the main video to an empty frame and capture it, then seek to a stocked frame and capture it. You can drag on the same video to adjust the monitored area. Set the low-stock limit on this page. These percentages are visual estimates, not exact product or SKU counts.
4. **Checkout Help:** Load the included checkout counter video or upload a checkout clip, then press **Start Analysis**. The purple rectangle marks the queue area. Set a warning level or click **Adjust queue area** and drag on the video for another camera angle. When staff opens another checkout, click **Mark another checkout opened**; the activity table records the current estimate and a later estimate after three video seconds. The button records a staff response and does not operate checkout hardware. Detection may miss or double-count shoppers, particularly with occlusion.

The recording selector on each analysis page shows only videos for that use case. Switching pages reloads the last selected video for that page from the start. Only one video is analyzed at a time; switching pages stops the current analysis. The entry/exit table is a browser-session log, while active visit records live only in the local server's memory.

## Recordings

The page lists only recordings actually present in `public/recordings`. Four public demonstration clips are included in Git: [grocery entrance](https://www.pexels.com/video/people-going-inside-a-store-with-automatic-sliding-doors-6641527/), [revolving building door](https://www.pexels.com/video/people-walking-passing-through-a-revolving-glass-door-4077491/), [shoppers leaving a clothing store](https://www.pexels.com/video/women-walking-out-of-a-store-6565790/), and [checkout counter](https://www.pexels.com/video/woman-at-the-cashier-14936143/), all from Pexels under its [free-use license](https://www.pexels.com/license/). These separate sample videos do not prove that the same person enters and exits. The checkout sample provides a counter view, not a validated queue benchmark. The ten local shelf recordings are excluded from Git. Their labels describe the visible content; short reference clips are marked as such. You can also upload MP4/WebM files on the relevant use-case page; selected files stay in the browser session. No raw frames are posted to `/api/events` or `/api/visits`.

## What the model can and cannot do

The bundled [TensorFlow COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) model detects generic people and objects locally in the browser. It does not recognize faces, identify shoppers, recognize SKUs, or verify purchases. Person tracks are temporary in-memory coordinates that expire. Entrance footfall, queue count, and dwell are derived from detected boxes plus configured zones. Shelf occupancy is a calibrated image comparison against empty and stocked reference frames; a product-removal or restock event is an inferred shelf change, not a verified item identity. Low and empty signals use configured thresholds. The synthetic demo is labeled SIMULATED throughout.

Frames, detector boxes, temporary track IDs, heatmap coordinates, and reference images remain in browser memory. The local Node receiver accepts an exact allowlist of anonymous fields and rejects extra fields. Visit records contain only a random visit token and entry time in server memory. They are deleted on a matched exit, reset, or after a two-minute timeout; restarting the server clears them. The receiver listens on loopback and stores only bounded in-memory events. This is a prototype privacy boundary, not a production security audit. Temporary box tracking may lose a person during occlusion, so the exit count depends on continuous tracking and correctly placed zones. The recordings themselves are raw video, so publish only consent-cleared footage.

## Build and tests

`npm test` runs the unit and receiver tests. The committed browser model bundle runs without installing dependencies. To rebuild it after changing `public/model-entry.mjs`, run `npm install` and `npm run build:model`.

The active app lives in `public/index.html`, `public/retail.css`, `public/retail-app.mjs`, and `public/retail-core.mjs`; `server.mjs` serves the local UI, approved model assets, included recordings, and the event API. `public/contract.mjs` is the shared privacy schema. The earlier shelf-only implementation remains in `public/app.mjs` and `public/styles.css` for reference.

