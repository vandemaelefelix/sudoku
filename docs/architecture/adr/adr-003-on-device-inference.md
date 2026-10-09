---
status: DRAFT
---

# ADR-003: All inference runs on the device

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
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
