# Prototype validation

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

The supplied clips were decoded and played locally in Edge. See `recording-results.json` for measured clip durations and motion-trigger counts. These results are smoke tests of the local video/event path, not accuracy measurements or actual product-pick counts. No clip includes the empty-shelf reference required for tested real stock classification.

## Remaining real-world validation

Capture empty and stocked views of a fixed shelf under the same camera and lighting. Calibrate its product zone and test real removals, replenishment, occlusion and lighting changes. Webcam input is implemented but physical webcam operation was not tested. Congestion and item-level product counting are not implemented.
