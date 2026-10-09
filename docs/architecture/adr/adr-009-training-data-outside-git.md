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

## Consequences

- Until DVC, a lost laptop means rebuilding the real data from backups. `ml/data/` must have
  a backup.

## Reassessment Triggers

- Training happens on a second machine, or real data passes about 500 MB. Adopt DVC.
