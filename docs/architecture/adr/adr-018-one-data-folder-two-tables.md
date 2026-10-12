---
status: DRAFT
---

# ADR-018: One data folder, two tables and a session journal

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-12 |
| Contact | Felix      |

Supersedes [ADR-009](adr-009-training-data-outside-git.md) in part: the data layout, the tracked
kind log and the photo list. The rest of ADR-009 stays: images outside git, a manifest in git,
synthetic data not stored, DVC later.

## Context

ADR-009 and its amendments spread the real data over two trees and five tracked files:

- `ml/data/` holds the images and the work folder. It is a symlink in every git worktree.
- `ml/datasets/` holds `cells.csv`, `kind-log.jsonl`, `photos.csv`, `photo-checks.jsonl` and
  `cell-origins.csv`.

The kind log grows with every click. It is 5.7 MB after two labelling days. A diff of a labelling
session is thousands of log lines, so a person cannot review it. Three files describe one cell:
`cells.csv` (digit and kind), the log (the kind) and `cell-origins.csv` (the source). Two files
describe one photo: `photos.csv` and `photo-checks.jsonl`. Some column names are vague:
`label`, `origin`, `photo`.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Keep the ADR-009 layout | No migration | Large diffs. Five files to read for one fact. Vague names |
| **Two tables in `data/`, a journal outside git** | One row per cell, one row per sudoku photo. Small diffs. One folder | Undo ends at Finish. The label history before Finish lives only in git |
| A SQLite file in git | Queries, one file | A binary diff. A merge needs a tool |

## Decision

1. One dataset folder at the repository root: `data/`.
   - Tracked: `data/cells.csv`, `data/sudoku-photos.csv`, `data/kind-checks.jsonl`,
     `data/STATUS.md` and `data/README.md`.
   - Not tracked: `data/images/` and `data/work/`.
2. The images live in `data/images/cells/<digit>/<id16>.png` and
   `data/images/sudoku-photos/<id16>.<ext>`. The environment variable `SUDOKU_IMAGES` can name
   another images folder, so that all git worktrees share one image store. The justfile reads a
   git-ignored `.env`.
3. `data/cells.csv` has the columns `cell_id,digit,kind,photo_id,row,col`.
   - `digit` is `1`-`9`, `empty`, `unlabeled` or `discarded`. It always equals the folder of the
     cell. The folder stays the source of truth for the digit.
   - `kind` is `printed`, `handwritten`, `unsure` or empty. It is empty for an `empty`,
     `unlabeled` or `discarded` cell. A digit cell without a kind is allowed.
   - `photo_id`, `row` and `col` (0-8) give the source of the cell. All three are set, or all
     three are empty.
   - The rows are sorted by digit, then by `cell_id`.
4. `data/sudoku-photos.csv` has the columns
   `photo_id,file,source,licence,attribution,status,corners`.
   - `status` is `pending`, `accepted`, `rejected`, `too-few-cells` or `legacy`. A `legacy`
     photo was cut before photo checks existed. The Photos screen never offers it.
   - `corners` holds the 4 accepted corners as `x1 y1 x2 y2 x3 y3 x4 y4` (TL, TR, BR, BL, one
     decimal) for an `accepted` photo. It is empty for other photos.
   - The rows keep the import order, so an import appends rows.
   - Decision times, reasons and cut sizes are not stored.
5. The **journal** `data/work/journal.jsonl` holds the changes of the unfinished work. Its lines
   have the format of the old kind log lines. A cut adds a `source` line for each new cell, so
   a crash after a cut loses no link.
   - The labels at runtime are the kinds and sources in `cells.csv`, with the journal lines
     applied on top in order.
   - Undo and `just label-rollback` work on the journal lines. They skip `source` lines: a
     source is a fact, not a label.
   - The start, the stop and Finish fold the journal into `cells.csv`. Finish then runs the data
     check and deletes the journal and the other derived files.
   - After Finish, Undo cannot reverse the finished changes. Git keeps the old tables. A rollback
     of a finished session says so.
6. The blind check answers live in `data/kind-checks.jsonl`, append-only and tracked. It is the
   one extra tracked file. The first answer creates it.
   - A kind from `cells.csv` counts as old enough for the check sample. A kind from the journal
     uses the time of its line.
7. Finish writes `data/STATUS.md`: a short summary of the dataset and the line
   `Last finish: <UTC time to the second>`. A plain data check never writes it.
   - Finish closes every open Review item. Only evidence newer than the last Finish opens an
     item: a kind change in the journal, a new check answer or a new `suspects.csv`.
   - The tool reads only the exact `Last finish:` line. A missing or bad line means "never
     finished".
8. `cells.csv` is the base of the kinds and the sources. The tool writes it to a `.part` file,
   then renames it. If `cells.csv` does not parse, the start and Finish refuse to run and say
   "Restore it from git." They do not rebuild it from the folders.
9. One module, `data_paths.py`, defines every path. The model runs stay in `ml/artifacts/`.
10. `just migrate-layout <old_ml_root> [--apply]` converts the old layout. It copies the images
    with APFS clones and never changes the old files. It does not migrate the kind log. Git keeps
    its history.

## Consequences

- A labelling session adds or changes rows in two small tables. A person can review the diff.
- The label history before the last Finish is only in git, as diffs of `cells.csv`.
- The progress count "Moved out" shows only the unfinished work. After Finish it is 0.
- The old files in `ml/datasets/` are not read any more. The developer removes them after the
  migration.

## Reassessment Triggers

- A person needs the time or the session of a finished label, for example for a label audit.
- Real data passes about 500 MB, or training moves to a second machine (DVC, ADR-009).
