---
status: DRAFT
---

# ADR-009: Training images outside git, a versioned manifest inside

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-09 |
| Contact | Felix      |

## Context

The real cells alone are 16k images and 167 MB. Synthetic data, EMNIST and app exports will
add more. Images in git bloat every clone forever. But a model is only reproducible if it is known
exactly which images trained it.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Images in git | Simple | History grows without bound |
| **Images in `ml/data/` (gitignored), manifest in git** | Simple. The manifest makes a dataset version exact and reviewable | Images live on one laptop. A backup is needed |
| DVC with S3 or R2 storage | Real dataset versioning, a remote copy, a portfolio-relevant skill | Another tool and a storage bill before there is much data |
| Git LFS | Familiar | Pays for bandwidth, weak at dataset versions |

## Decision

1. Images live in `ml/data/`, gitignored.
2. Each dataset version is a **manifest** in git: one line per image with its hash and the
   label from the [model contract](../00-concepts/model-contract.md). A model card records the
   manifest hash it was trained on.
3. Synthetic data is not stored. The generator and its seed are the dataset.
4. `fixtures/scans` is the exception: small, precious, and needed by app tests. It is committed.
5. **DVC is the planned next step**, when the data needs a second machine or a backup (R-04).

## Amendment: kind labels in an append-only log (2026-10-11)

- The kind of a real cell lives in `ml/datasets/kind-log.jsonl`, in git. Each line is one change:
  time, session, action, cell id, field, old value, new value and screen. Lines are never
  deleted. An undo or a rollback appends lines that reverse earlier lines.
- `cells.csv` gets a `kind` column: `printed`, `handwritten`, `unsure`, `none` or blank.
  `just dataset-manifest` computes it from the folders and the log. The folders stay the source
  of truth for the digit.
- The kind means how the mark was made: `printed` by a printer or a screen, `handwritten` by a
  person with a pen or a pencil. A typed player entry in an app screenshot is therefore
  `printed`.
- The blind check answers live in `ml/datasets/kind-check.jsonl`, in git. They never change a
  label.
- The log holds ids and words only, never an image (SUD-08).
- Design: [kind labelling design](../../superpowers/specs/2026-10-11-kind-labelling-design.md).

## Consequences

- Until DVC, a lost laptop means rebuilding the real data from backups. `ml/data/` must have
  a backup.

## Reassessment Triggers

- Training happens on a second machine, or real data passes about 500 MB. Adopt DVC.
