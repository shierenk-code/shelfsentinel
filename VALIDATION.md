# Prototype validation

## 8 October 2026 update

The updated project passes all nine `npm test` checks, including the staff alert lifecycle, body rejection on action endpoints, uncertain-tile suppression, stable-state confirmation, and localized-motion gate. The browser demo was checked for low-stock alert creation, acknowledgement, automatic closure on replenishment, response time, tile explanation, and both privacy gates blocking the synthetic attack. Changing synthetic stock state no longer increments the motion trigger count. With **Obstruct view**, the dashboard showed **View uncertain**, held the previous 100% reading, and emitted no new stock event during the observed obstruction. The recovery calculator initializes to ₹7,500 for its displayed assumptions. Physical shelf accuracy remains unmeasured; use the protocol in `SHOWCASE.md` before claiming real-world performance.

Tested locally on Windows with Node.js and headless Microsoft Edge on 7 October 2026.

## Automated checks

`npm test`: **5 tests passed, 0 failed**.

- All four operational event schemas accept their valid shapes.
- Extra fields including frames, biometric embeddings, coordinates, appearance, identifiers and metadata are rejected.
- Unknown types, invalid scalar/nested values, out-of-range numbers, missing fields and invalid metadata fail closed.
- Stocked, partially stocked and empty calibration vectors produce 100%, 33% and 0%; indistinguishable references fail.
- Receiver checks verify valid event acceptance, direct schema-bypass rejection, oversized-request rejection, malformed JSON rejection, cross-origin rejection, reason-only audit and reset.

## Browser flow

The browser test exercised the actual page and local HTTP receiver:

- Start synthetic analysis: 100% occupancy.
- Low-stock and empty controls: corresponding dashboard states and replenishment alerts.
- Empty stockout clock: increases during active analysis.
- Pause: approved-event total remains unchanged during the observation check.
- Privacy attack: edge and receiver both report BLOCKED; two reason-only audits appear.
- Local recording selected through the browser file input: anonymous `shelf_interaction` events; no stock status without calibration.
- Recording end: analysis pauses and metrics remain.
- Outgoing POST request inspection for the recording: only reset and anonymous event JSON; no recording, filenames or frame data.
- Zero browser JavaScript errors.
- Desktop and 390px mobile screenshots inspected; mobile has no horizontal overflow.

## Recording checks

The four supplied clips in `OneDrive_2026-10-07.zip` were decoded and played locally in the browser on 8 October 2026 with the current localized-motion detector. The observed motion-trigger counts were 3, 5, 3 and 5, in the order shown in `recording-results.json`. These counts are sensitive to playback timing and are **not** product-pick counts or an accuracy measurement. All four runs remained **Uncalibrated** for stock state.

Opening and closing frames showed the shelf stocked in every clip. The filename phrase “zero products” describes the intended product-pick scenario, not a visually empty shelf reference. No clip supplies the visibly empty and stocked pair for the same shelf zone that this classifier needs. Raw recordings were inspected locally; they were not added to the repository or sent to the local receiver.

## Remaining real-world validation

Capture empty and stocked views of a fixed shelf under the same camera and lighting. Calibrate its product zone and test real removals, replenishment, occlusion and lighting changes. Webcam input is implemented but physical webcam operation was not tested. Congestion and item-level product counting are not implemented.
