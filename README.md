# ShelfSentinel — working hackathon prototype

Local shelf video analysis, anonymous operational events, a live dashboard, and a strict Privacy Firewall. Built from the [ShelfSentinel hackathon idea](https://github.com/shierenk-code/shelfsentinel). The original concept is preserved in `HACKATHON_IDEA.md`.

## Run

Requires Node.js 20 or newer. No npm dependencies, API key, cloud service, or installation step.

```powershell
cd path\to\shelfsentinel
npm start
```

Open **http://127.0.0.1:8787** in Edge or Chrome. Alternatively, double-click `start.cmd` on Windows. Keep the terminal open while using the prototype. Ctrl+C stops it. To choose another port, set `PORT` before running the server.

## Three-minute demo

If Start Analysis reports that the local server is unavailable, run `npm start` in this repository and keep that terminal open. The page can remain visible after the server stops, but `/api/reset` and event requests then fail. Reload `http://127.0.0.1:8787` once the server is running. Choosing a recording opens it locally; it does not upload the video.

1. Click **Start analysis** with the synthetic demo selected. The shelf shows 100% estimated occupancy.
2. Click **Low stock**, then **Empty**. Within about two seconds, the dashboard updates and issues replenishment alerts. Empty-shelf observation time accumulates.
3. Click **Run privacy attack**. The edge gate blocks a synthetic embedding/coordinate payload. A deliberate API bypass probe demonstrates that the receiver also rejects it. The audit retains only a timestamp and fixed rejection reason.
4. Inspect **What the network sees**: typed operational JSON, with no frames, coordinates, customer identifier, or appearance fields.
5. Click **Pause**. The event stream and stockout clock stop; existing metrics remain.
6. For the staff workflow, click **Low stock**, **Acknowledge**, then **Stocked**. The server records time from alert opening to recovery.
7. Click **Obstruct view**. The dashboard marks the view uncertain and holds the last verified stock signal until enough shelf tiles are visible again.

See [SHOWCASE.md](SHOWCASE.md) for a judging walkthrough, physical shelf test protocol, deployment discussion and ROI method.

The synthetic shelf is clearly labeled and supplies known empty/stocked references. It is not a claim of performance on real stockout footage.

## Use your four supplied recordings

Click **Choose recording**, select a local MP4 from the `Privacy First Hackathon` folder, and click **Start analysis**. The video remains local; the server never receives the file or its name. The seek slider allows choosing reference frames. Choosing another source starts a fresh analytics session on the next Start.

The supplied clips show product pickup/return activity with a stocked shelf. They do not provide an empty-shelf reference. They can immediately demonstrate **motion triggers**; stock status stays **Uncalibrated** until both valid references are supplied. Motion triggers are a rough interaction proxy, not a verified count of shoppers, pickups, returns, or purchases. Filenames are not used as ground truth or inputs to the detector.

For real shelf availability:

1. Use a fixed camera and consistent lighting. Expand **Shelf zone & calibration** and bound the products using X/Y/Width/Height percentages. The coordinates stay in browser memory.
2. Pause a recording at a visibly empty shelf and click **Capture empty**, then at the stocked shelf and click **Capture stocked**. For a webcam, physically empty/stock that shelf and capture each state.
3. Start analysis. Changing the zone invalidates the references. References that are too similar stop classification with an explanation.

## What is implemented

- Browser video decoding and processing using canvas; MP4/WebM input and webcam, without audio.
- A 6 × 3 shelf grid. Mean RGB samples are compared with empty and stocked references. Tiles that match neither reference or are ambiguous are withheld. If fewer than 65% of distinguishable tiles are visible, stock judgment pauses. `empty` ≤ 15%, `low` ≤ 45%, otherwise `full`. A four-sample window smooths occupancy and three matching states confirm a transition.
- Localized shelf motion from changes between consecutive grid samples, with a three-second cooldown. Broad scene changes are ignored. Product movement or occlusion can still trigger the interaction proxy.
- Strict allow-listed event validation at the browser edge and independently at the local receiver. Unknown fields, missing fields, nested values in scalar fields, invalid types/ranges, arbitrary shelf identifiers, and oversized requests are rejected.
- Approved/blocked totals, reason-only audit, bounded event stream, restock alerts, observation time, and anonymous motion totals.
- A replenishment task that opens on low/empty, can be acknowledged, and closes when the shelf is stocked again. The local receiver measures response time.
- A browser-local tile explanation and labeled-frame validation table. The table requires a real recording or webcam and clears when the source or zone changes.
- An editable sales-recovery scenario whose inputs and output stay in the browser. It is an assumption-based opportunity, not measured ROI.
- Responsive dashboard, local-only server, source changes, pause/resume, seek, and video-end handling.

## Privacy boundary and practical limits

The browser represents the edge device. Frames and calibration vectors are processed there. The browser retains the current preview and selected local recording object for playback; your original file remains on disk. No video is uploaded or written by this app. There are no external scripts, fonts, analytics or cloud calls. Webcam tracks stop on source change or tab close.

The Node server listens only on `127.0.0.1`. Operational events and fixed audit reasons are kept in process memory; restart clears them. It keeps the last 200 events and 50 receiver audit records; aggregate totals continue beyond that window. The edge retains the last 20 reason-only audit records. The explicit privacy attack uses invented test values, not genuine biometric data.

This is an architecture demo, not a hardened edge appliance. A compromised browser could bypass its client validator; the receiver's strict schema remains the second boundary. Receiver rejection alone cannot prevent a malicious client from attempting transmission. Production needs signed/attested edge builds and a protected transport boundary. No face recognition, demographics, person tracking, persistent IDs or object recognition is performed. Congestion is part of the contract for future extension, but this prototype does not generate congestion events.

The grid method is sensitive to lighting, occlusion and camera movement. Uncertain tiles and temporal confirmation reduce false alerts but do not establish real-world accuracy. It does not count individual products or recognize SKUs. Stockout duration measures active wall-clock observation, excluding pauses and uncertain views; it is not a historical duration reconstructed from a recording. The API is intended for a single local demo session without authentication. Browser refresh preserves server metrics but loses edge calibration, local validation samples, scenario inputs and edge audit history.

## Verify

```powershell
npm test
```

Tests cover the privacy contract, malformed/forbidden data, calibrated stock states, and receiver behavior including bypass attempts, oversized requests, origin rejection and session reset. See `VALIDATION.md` for the browser and recording checks performed on this machine.

## Files

`server.mjs` is the dependency-free local receiver; `public/contract.mjs` defines the firewall; `public/perception.mjs` defines the shelf classifier; `public/app.mjs` owns edge processing; `public/index.html` and `styles.css` provide the dashboard.
