---
status: DRAFT
---

# ADR-004: Two-stage scan pipeline with per-cell flattening

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-09 |
| Contact | Felix      |

## Context

Puzzles come from newspapers (flat) and puzzle books (curved near the spine). Curved pages
should work "to some level" without the project going deep into page dewarping. The earlier
Python project handled curvature after the fact on still photos, with Hough lines, splines and
scipy solvers across about 4,000 lines. A live camera changes the problem: the user can adjust
the phone until the outline locks on, so the input is already much better.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Single 4-corner flatten | Simplest, cheapest | Cells near a book's spine come out off-centre and get misread |
| Full page dewarping (splines, mesh fitting) | Handles strong curvature | The approach that grew to thousands of lines. Hard to port (scipy) |
| ML grid segmentation from the start | Robust | A second model to build before the first scan works |
| **Two stages: 4 corners live, per-cell flatten on capture** | The live part stays cheap. Curvature handled piece by piece with simple maths. An ML step can replace one stage later | Strong curvature still imperfect |

## Decision

1. **Live:** detect the 4 outer corners on every frame, smooth them, lock on when steady.
2. **Capture:** rough flatten from the 4 corners, find the 100 intersections near their expected
   positions, flatten each cell from its own 4 corners, classify the 81 cells.
3. Intersections are found **classically first**. A small keypoint model replaces that step only
   if fixtures from book pages show the classical method is not enough (F-12).

Details in [scan-pipeline](../00-concepts/scan-pipeline.md).

## Consequences

- The fixture set needs book pages from the start, so the F-12 trigger is measured, not guessed.
- The transition animation gets the intersections for free and can draw the true grid.

## Reassessment Triggers

- Grid-exact accuracy on book-page fixtures stays well below newspaper fixtures after tuning.
  Start the intersection model.
