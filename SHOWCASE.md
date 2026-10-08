# ShelfSentinel showcase guide

The FLO 2026 kickoff scores retail value, privacy by design, technical innovation, real-world performance, and explainability. This guide maps the working demo to those five dimensions. It does not claim a measured accuracy or return on investment before a physical shelf trial.

## Three-minute demo

1. Open `http://127.0.0.1:8787`, select **Synthetic demo**, and click **Start analysis**. Point to the local preview, 18-tile explanation, and approved event stream. The synthetic references are built in.
2. Click **Low stock**. The replenishment task opens. Click **Acknowledge** to show a staff action. Click **Empty**, then **Stocked**. The task closes and the server reports elapsed response time.
3. Click **Obstruct view**. The stock signal is held while the synthetic shelf is blocked; no new stock judgment is sent. Point to the uncertain tiles, then wait for the view to clear.
4. Click **Run privacy attack**. The edge validator and the local receiver both reject an invented face embedding and coordinates. The audit shows only a fixed reason and time.
5. Adjust the recovery scenario. Explain the formula and that it is an assumption-based sales opportunity before cost or margin, not a measured ROI.
6. If a fixed physical shelf and camera are available, switch to the webcam. Set the shelf zone, capture a genuinely empty reference, then a stocked reference, and start analysis. Record the actual state for several frames in **Field validation**. Report the sample count and results honestly.

## What the judges can inspect

| Criterion | Live evidence | Honest limit |
| --- | --- | --- |
| Retail value | Low/empty alert, staff acknowledgement, recovery time, adjustable sales scenario | Sales impact needs pilot measurements |
| Privacy by design | Browser-local frames, strict event schema, second receiver gate, reason-only rejection audit | A compromised browser can attempt transmission; a production edge device needs attestation and transport controls |
| Technical innovation | Local 6 × 3 shelf comparison, uncertain-tile gate, stable-state confirmation, tile explanation, executable privacy contract | Color comparison is still sensitive to lighting, occlusion and camera movement |
| Real-world performance | Webcam/recording input and local labeled-frame table | No real shelf accuracy is established until a physical trial is run |
| Explainability | Visible tile states, data stream, privacy attack, architecture and limits in README | Tiles are occupancy estimates, not product or SKU counts |

## Physical shelf test protocol

The four supplied MP4s are useful for showing local recording playback and motion signals. They do not contain a visibly empty shelf reference, so do not use them to claim tested stock classification or pickup counts.

Use a fixed camera and stable light. Choose a shelf zone with products filling most of its area. Capture empty and stocked references under the same conditions; the page reports how many tiles are distinguishable. If fewer than six tiles differ enough, recapture references or change the zone.

Before the showcase, collect at least 30 labeled frames from a physical shelf, across stocked, low and empty states. Include different people occluding the view, lighting changes, product removal and replenishment. Record every frame selected in the field validation table, including failures. The table is an operator-selected spot check in browser memory; it is not an independent benchmark. For a stronger claim, keep a separate holdout recording that was not used for calibration, label it independently, and report a confusion matrix with the sample count. Do not present the synthetic demo as real-world accuracy evidence.

## Deployment and economics

The current prototype needs one ordinary camera and a browser device per shelf, plus a local Node receiver. It uses no paid API or cloud service. A production pilot would need fixed camera mounting, device hardening, monitoring, staff alert routing, data retention controls and independent privacy review. Price those items using the actual store and device choices; this repository makes no unsupported hardware-cost claim.

For a pilot, measure daily empty-shelf minutes, sales per stocked hour, response-time change and the fraction of empty time genuinely recovered. The dashboard computes `empty minutes ÷ 60 × stocked-hour sales × recovered fraction × 30`. To turn that sales opportunity into ROI, apply the retailer's gross margin, subtract hardware, maintenance and staff costs, and compare with a control shelf or period. Avoid attributing all sales change to this system without a controlled comparison.
