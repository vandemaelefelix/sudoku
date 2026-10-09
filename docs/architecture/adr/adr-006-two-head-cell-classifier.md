---
status: DRAFT
---

# ADR-006: One cell classifier with a digit head and a kind head

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-09 |
| Contact | Felix      |

## Context

A scanned puzzle-book page is often half-solved. To resume it, the app must keep apart the
printed starting digits (givens) and the player's handwritten entries, and ignore pencil notes.
So each cell needs two answers: which digit, and what kind of mark.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Printed + empty only | Least data work | Half-filled pages cannot be resumed. Handwriting is flagged and fixed by hand |
| Every digit is a given | Simple | The player's own entries become locked givens |
| One flat 20-class head (`empty`, `notes`, printed 1–9, handwritten 1–9) | One output | Splits each digit's data in two. The digit "7" is learnt twice |
| Two separate models | Independent training | Two files, two passes, two contracts |
| **One model, two heads** | Shares what a digit looks like across kinds. One file, one pass | Two losses to balance |

## Decision

One small CNN (about 100k parameters, 32 × 32 grayscale input) with two output heads:

- `digit`: `empty, 1–9`
- `kind`: `none, printed, handwritten, notes`

The full specification is in [model-contract](../00-concepts/model-contract.md). The scan loads
printed digits as givens, handwritten digits as editable player entries, and notes cells as empty.

## Data

| Source | Gives | Notes |
| --- | --- | --- |
| Synthetic printed digits | Unlimited `printed` and `empty` | Rendered in many fonts, with blur, perspective, paper texture, lighting and leftover grid lines |
| Real cells in `ml/data/cells/` (~16k) | Real printed and some handwritten digits, empty cells | Add the kind. 71 cells still need a label |
| EMNIST digits | `handwritten` | Augmented to look like ink inside a printed cell |
| App export (F-11) | Real everything, especially the player's own handwriting | The correction screen's given / mine toggle labels the kind |

## Consequences

- Handwriting is the weakest class at first. Expect the correction screen to do real work until
  app exports accumulate.
- A kind mistake is cheaper than a digit mistake: it only changes whether a cell is editable, and
  the player can toggle it.

## Reassessment Triggers

- Kind accuracy plateaus while digit accuracy is fine. Consider weighting the losses or a
  separate kind model.
