---
status: ACCEPTED
---

# ADR-019: Lock-on on a tracked grid, not on a still phone

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Accepted   |
| Date    | 2026-10-12 |
| Contact | Felix      |

Supersedes the lock-on condition of ADR-004 ("lock on when steady"). The other points of ADR-004 stay.

## Context

ADR-004 locks on when the grid is steady. Steady reads a speed from one detection step. On the
iPhone, a hand-held phone over a still page gave a median of 28.8 pt/s and a 90th percentile
of 97 pt/s. Steady needs about 15 pt/s. Steady was true in 16 % of the frames, and the scan never
locked on. Each person holds a phone in a different way, and nobody holds it still. The scan
already tracks one grid across frames: only a jump of a quarter of the diagonal is another grid.

A second device run found a second block. After a Retake, the scene was not armed for 4 to 11 s
with the grid in view. It armed only on a jump or a loss. A smooth move to another puzzle is
neither, so the scan did not lock on. The hand-held drift was p90 125 pt/s and p95 171 pt/s.
A pan was 200 to 370 pt/s.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Drift over a window: the net corner move over `DRIFT_WINDOW` | Noise and tremor cancel, a pan stays. One measure for every hand | Two new constants to tune |
| A higher `STEADY_SPEED` | The smallest change | The spikes stay. One spike still starts the dwell again |
| A grace time for short drops of steady | Keeps the measure | The speed stays noisy. One more constant |

## Decision

The scan locks on when the same grid stays in view for `LOCK_DWELL`, and the phone does not
clearly move.

- The **drift** is the largest net corner move over `DRIFT_WINDOW` = 0.3 s, in points per second.
- The drift is a sliding window, measured in every frame. A pan stops lock-on before the grid moves more than about `DRIFT_LIMIT` × `DRIFT_WINDOW` = 45 pt.
- A drift above `DRIFT_LIMIT` = 150 pt/s is a clear move. It starts the dwell again.
- The intent rules of the scan-pipeline concept stay: the warm-up and the minimum grid size.
- A Retake starts a fresh scan. The Retake block of issue #19 (a scene that is not armed) is removed.
- `motion` and steady stay. They drive the overlay only.

## Consequences

- A hand-held phone locks on after the warm-up and the dwell.
- A pan over the page does not lock on until the pan stops.
- The photo can have more motion blur than before. The burst planned in issue #73 is to pick the sharpest photo.
- After a Retake, the scan locks on after the warm-up and the dwell, also on the same puzzle. The burst planned in issue #73 is to make a second capture of the same view useful.
- The iPhone run of 2026-10-12 validated the rule: 14 scans, Retakes on the same and another puzzle, and pans. The hand-held drift had a median of 34 pt/s.

## Reassessment Triggers

- Scans after lock-on show motion blur that the burst does not fix.
- The scan locks on during a pan, or before the player means it.
- The device run gives a `DRIFT_LIMIT` far from 150 pt/s.
- Players get an unwanted second capture right after a Retake.
- Issue #73 is not built, or it is dropped.
