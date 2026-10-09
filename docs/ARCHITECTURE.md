# ShelfSentinel architecture and technology stack

ShelfSentinel is a local, single-store prototype with four product views: Overview, Entry & Exit, Shelf Maintenance, and Checkout Help. One browser tab analyzes one selected video at a time. The Node.js server serves the app and approved recordings, accepts narrowly defined events, and keeps temporary visit records in memory.

## Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| Interface | HTML, CSS, browser JavaScript modules | Four views, video controls, tables, status, and zone calibration |
| Video | Browser `<video>`, Canvas 2D | Decode a selected MP4, display one annotated view, seek to evidence, and sample shelf pixels |
| Person and object detection | TensorFlow.js and COCO-SSD lite MobileNet v2 | Detect generic people and objects in the browser; model bundle and weights are served locally |
| Shelf analysis | `public/perception.mjs` | Compare a shelf crop with empty and stocked reference frames; report an estimate only when the comparison is usable |
| Tracking and rules | `public/retail-core.mjs`, `public/retail-app.mjs` | Maintain temporary person tracks, apply doorway-zone transitions, and generate shelf observations and alerts |
| Local API | Node.js 20+ built-in HTTP server | Serve approved files and video ranges, validate events, and manage visit records |
| State | Browser memory and Node.js process memory | Hold the current analysis, event history, and anonymous active visits; no database is used |
| Build and checks | esbuild, Node.js test runner | Bundle the local model and run privacy, API, shelf, and tracking tests |

`package.json` contains the exact dependency versions and commands. `npm start` serves the app at `http://127.0.0.1:8787/`; `npm test` runs the checks.

## Processing stages

1. **Source selection.** The browser chooses an included recording from `public/recordings.mjs` or a local MP4/WebM upload. The server exposes only allowlisted included filenames and supports byte-range requests for seeking. Local uploads use browser blob URLs.
2. **Local frame analysis.** The selected video is decoded in the browser. Canvas displays its frame and zone outlines. The bundled model detects generic person and object boxes. No face recognition or SKU recognition runs.
3. **Use-case rules.** On Entry & Exit, temporary box tracks are checked against configured entrance and exit zones. On Shelf Maintenance, the selected shelf area is sampled for visual changes. An occupancy percentage requires empty and stocked reference frames; the restocking sample has a preset calibration. Visual movement without calibration is labeled unverified. On Checkout Help, temporary person tracks with footpoints in a queue rectangle drive a count, threshold alert, and observed dwell.
4. **Product display.** Entry & Exit shows observed crossings and active anonymous visits. Shelf Maintenance shows visual stock estimates, empty space, and time-linked activity. Checkout Help shows queue estimates, warnings, staff response marks, and a later observed count. Overview summarizes the latest counts and last measured shelf condition.
5. **Local receiver.** The browser sends only schema-approved operational events to `/api/events`. It calls `/api/visits/open` and `/api/visits/close` for observed matched visits. The server rejects extra fields and bounds its in-memory event history.

## Privacy boundary and data lifetime

- Raw frames, detector boxes, reference images, and temporary tracking coordinates remain in the browser session. Included raw recordings are files on the local server and are delivered to the browser for analysis; they are not sent in event requests.
- An active visit record contains a random token and entry time in server memory. A matched exit deletes the record. If an exit is missed, it expires after two minutes. Server restart clears all visits and events.
- Separate entrance and exit stock videos cannot establish that the same shopper appears in both. An exit-only observation therefore does not delete an unrelated active visit or reduce the estimated inside count.
- The app listens on loopback and is a prototype privacy boundary. It has no authentication, persistent database, multi-camera identity matching, production audit, or exact inventory count.

## Main code locations

| Path | Responsibility |
| --- | --- |
| `public/index.html`, `public/retail.css` | Product markup and styling |
| `public/retail-app.mjs` | Page behavior, video session, local analysis, tables, and API calls |
| `public/recordings.mjs` | Use-case labels, available filenames, and calibrated sample metadata |
| `public/perception.mjs` | Shelf image comparison and visual-change checks |
| `public/retail-core.mjs` | Zones, temporary tracks, and operational rules |
| `public/contract.mjs` | Allowlisted event schema |
| `public/model-entry.mjs`, `public/model-bundle.mjs`, `public/models/` | Browser detection model and local weights |
| `server.mjs`, `visit-store.mjs` | Loopback HTTP API, media serving, and expiring visit store |
| `test/` | Node.js tests for the privacy and analysis contracts |

## Demo scope

The three public doorway samples and one public checkout sample are included in Git. The ten locally recorded shelf clips are excluded from Git; the app lists them only when present on the local server. The default restocking clip can show an empty-to-stocked shelf transition. Other camera angles require reference capture before a stock percentage is meaningful. All stock percentages describe visual similarity within a chosen shelf region, not product counts. Checkout counts are person-box estimates within a marked region; an observed decrease after staff action is not causal evidence.
