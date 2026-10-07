# ShelfSentinel

## Privacy-first smart shelf operations

ShelfSentinel helps retailers spot empty shelves and rising customer interest without creating customer-surveillance data. A camera at the shelf processes video locally and publishes only anonymous operational events.

> **The camera sees the shelf. The network sees only inventory signals.**

## The problem

Empty shelves cause lost sales, while manual stock checks consume staff time. Conventional camera analytics can create an unnecessary privacy risk by retaining or transmitting shopper footage before it is blurred or deleted.

Retail teams need shelf availability and interaction signals. They do not need identities, faces, video archives, or cross-visit tracking.

## The solution

ShelfSentinel runs computer vision on an edge device beside the shelf. It converts the live feed into a small set of anonymous retail events:

| Retail question | Anonymous event |
| --- | --- |
| Is the shelf stocked? | `shelf_status` with `full`, `low`, or `empty` |
| Has an item stayed unavailable? | `stockout_duration` in seconds |
| Are shoppers engaging with this shelf? | `shelf_interaction` with an event count |
| Is the aisle getting crowded? | `congestion` with an anonymous count |

Raw frames stay on the edge device and are discarded after processing. ShelfSentinel never performs facial recognition, demographic inference, gait analysis, appearance classification, or cross-visit identification.

## Privacy Firewall

ShelfSentinel includes a **Privacy Firewall** between edge perception and analytics. Every event must match an allow-listed schema before it leaves the device.

The firewall rejects:

- Images or video frames
- Face embeddings and biometric vectors
- Pixel coordinates or location trails
- Appearance descriptors
- Persistent identifiers
- Unexpected metadata

This makes privacy a testable system property, not a deletion-policy promise.

## Demo flow

1. A webcam or recorded shelf feed runs locally.
2. The edge device detects shelf status and anonymous interactions.
3. Approved events update a live dashboard with stock, stockout, and congestion metrics.
4. A presenter removes products from the shelf to trigger a low-stock or empty-shelf alert.
5. The presenter runs a simulated privacy attack containing a face embedding and pixel coordinates.
6. The Privacy Firewall blocks the event, explains the violation, and records it in the audit panel.
7. Pausing the camera stops new events while the existing operational metrics remain available.

## Architecture

```text
Camera or recorded shelf feed
            |
            v
Local edge perception
            |
            v
Anonymous candidate event
            |
            v
Privacy Firewall -----> Rejection audit panel
            |
            v
Retail dashboard and operational alerts
```

## Retail value

- Staff receive a low-stock alert before a shelf stays empty for long.
- Store managers can prioritize replenishment where customer engagement is highest.
- Aggregated signals help assess shelf availability without creating a customer-profile database.

### Illustrative ROI model

For a pilot, measure the reduction in time that high-selling products remain unavailable. Multiply recovered selling time by the average sales rate for that shelf. The same dashboard can track restock response time for store teams.

## Hackathon scope

This project demonstrates the privacy boundary and retail workflow with one physical shelf, a webcam or recorded footage, and a local dashboard. It is a proof of architecture, not a production surveillance system.

A production implementation would add robust shelf detection, signed edge builds, device attestation, aggregate-data retention controls, transport monitoring, configurable shelf zones, and an independent privacy review.

## Why it fits FLO 2026

| Judging area | ShelfSentinel response |
| --- | --- |
| Retail value | Detects stockouts and prioritizes replenishment |
| Privacy by design | Only anonymous, allow-listed events leave the edge device |
| Technical innovation | Edge computer vision plus an executable privacy contract |
| Real-world performance | Works with a normal shelf, camera, and local dashboard |
| Explainability | Simple data flow, clear limitations, visible privacy test |

## Pitch

Retailers lose sales when shelves are empty, but fixing that problem should not require recording shoppers. ShelfSentinel watches a shelf locally, detects stock availability and anonymous interaction, then sends only operational events such as “snacks shelf is low” or “aisle congestion increased.”

Our Privacy Firewall is the difference. It rejects frames, faces, biometric vectors, coordinates, and identifiers before analytics can receive them. During our demo, we attack the system with forbidden data and show it being blocked live. ShelfSentinel gives stores the signals they need to restock faster without building a customer-surveillance system.

## Team

Built for the FLO 2026 Hackathon.
