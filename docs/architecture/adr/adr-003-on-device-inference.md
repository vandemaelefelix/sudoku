---
status: ACCEPTED
---

# ADR-003: All inference runs on the device

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Accepted   |
| Date    | 2026-10-09 |
| Contact | Felix      |

## Context

The scanner runs two kinds of computation: per-frame grid detection and per-capture cell
classification. Either could run on the phone or on a server. There is no backend in v1 (TC-3),
the game must work offline (F-08), and the app replaces one that does not respect its users
(OC-3).

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| **On device** | Works offline. Zero latency for the live outline. No running cost. Photos stay private | Model size and speed limited by the phone. Model updates ship with app updates |
| Cloud inference | Any model size. Update models without an app release | Needs the backend that does not exist. Useless for per-frame detection. Costs money per scan. Photos leave the phone |
| Hybrid (live on device, recognition in the cloud) | Bigger recogniser possible | Still needs a backend and a network. The recogniser is tiny anyway |

The models are small. The cell classifier is well under 1 MB, and a possible intersection model a
few MB. Nothing here needs a server.

## Decision

All inference runs on the device. Camera frames, photos and cell images never leave the phone
without an explicit user action for each export (SUD-02).

## Consequences

- Models are bundled with the app, so a better model needs an app build. Acceptable while the
  developer is the main user.
- Exporting a corrected scan as training data (F-11) sends cell images off the phone, but only
  when the player chooses to, each time. That is what SUD-02 allows.
- The cloud enters only later, for training data: corrected scans uploaded by choice, once the
  backend exists. That is a training concern, not inference, and gets its own ADR.

## Reassessment Triggers

- A model that would help does not fit the phone's speed or memory budget.
- Over-the-air model updates become worth having (with the backend).

## Amendment 2026-10-16: scan collection

[ADR-030](adr-030-scan-collection.md) amends the rule on exports in the Decision and the Consequences.

1. Inference still runs on the device. Camera frames and cell images never leave the device.
2. A photo leaves the device only through the setting "Help improve the app". The setting is on by default. The
   player can turn it off. The rule "an explicit user action for each export" ends.
3. F-11 is now the upload of a finished scan through this setting. The player no longer chooses each time.

## Amendment 2026-10-22: accepted

The code on `develop` proves this decision. The status moves from Proposed to Accepted. The decision does not change.

- `mobile/src/scanner/classifier.ts` runs the cell classifier with fast-tflite on the iPhone (#25, #29). The scan
  needs no network (SUD-01).
- No code sends a camera frame or a cell image.
- `mobile/src/scanShare/` uploads the photo of a finished scan only while the setting "Help improve the app" is on
  (#152, #153). [ADR-030](adr-030-scan-collection.md) holds the rules of that upload.
