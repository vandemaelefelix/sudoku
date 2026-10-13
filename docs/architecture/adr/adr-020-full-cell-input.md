---
status: ACCEPTED
---

# ADR-020: The model reads the full cell

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Accepted   |
| Date    | 2026-10-13 |
| Contact | Felix      |

Replaces the crop rule of model contract 1 (step 2 of the input steps). The other rules of the contract stay.

## Context

Contract 1 crops each 64 × 64 cell to rows and columns `[6, 58)`. The reason was to drop the grid lines, which lie on the cell border. Printed digits sit in the middle of the cell, so the crop costs them nothing.

Handwritten digits do not stay in the middle. A pen digit can reach the border, and the crop then cuts it. On the phone scans of 2026-10-13 the model read some handwritten 2s as 9s. Five of the six misread handwritten cells had 14 to 35 % of their pen ink outside the crop. On all handwritten cells of those scans, 18 % had more than 15 % outside. The bottom stroke of a 2 is the part that makes it a 2.

An experiment trained three models on the same data and the same seed. It tested them on three saved phone scans (243 cells) and on the standard test split.

| Crop | Digit errors on the scans | 2 read as 9 | Test digit | Test kind |
| --- | ---: | ---: | ---: | ---: |
| `[6, 58)`, 52 px (contract 1) | 7 | 3 | 99.35 % | 98.90 % |
| `[2, 62)`, 60 px | 8 | 1 | 99.44 % | 98.90 % |
| `[0, 64)`, the full cell | 4 | 1 | 99.44 % | 98.74 % |

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Keep `[6, 58)` | No contract change | Cuts digits that reach the border. 7 errors on the scans |
| `[2, 62)` | Keeps almost all of the digit. Drops the outer line pixels | 8 errors on the scans. No clear gain |
| The full cell | Keeps all the ink. 4 errors on the scans. The simplest rule: no crop | The grid lines are in the input. Test kind accuracy is 0.16 points lower |
| The full cell with the grid lines masked | Keeps the ink, drops the lines | A masking step in the model contract and in both implementations. Not needed so far |

## Decision

The model reads the whole 64 × 64 cell. The resize to 32 × 32 is the exact area average of the whole cell: each output pixel is the mean of a 2 × 2 block. The grid lines stay in the input, and the model learns that they are not part of the digit.

- This is a new major version of the model contract: **2.0**. The scanner implements major version 2 only (SUD-09).
- The model version is 2.0.0. `fixtures/preprocess/` holds new expected values for `ml/` and the scanner.
- A model that was trained on cropped cells is refused.

## Consequences

- The model sees the whole digit, also when it touches the cell border.
- A cell cut a little off the grid shows a bit of the neighbour cell and more grid line. The model has to cope with this.
- The test kind accuracy is lower by 0.16 points. A larger set of phone scans decides whether this matters.
- Models of contract 1 do not run in the app. The one model of the project is trained again with the new input.

## Reassessment Triggers

- A set of 10 or more saved phone scans (about 800 cells) shows no gain from the full cell. Then reconsider the `[2, 62)` crop.
- The kind accuracy keeps dropping. Then consider masking the grid lines.
