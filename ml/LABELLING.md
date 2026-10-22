# Labelling app

Run `just label-cells` and follow the start page.

The labelling app turns sudoku photos and loose cells into labelled cells. It runs on your Mac
only, on 127.0.0.1 (SUD-02). A **sudoku photo** is a photo of a whole sudoku. A **cell** is one
square cut from it. The app lives in `tools/label-app/`. The Python label server holds the data
(ADR-034).

## Run

1. `just label-cells` builds the app when a source changed. Then it starts the server and opens
   `http://127.0.0.1:8765/`. `just label-cells port=8799` uses another port.
2. The start page shows the two flows. Each step shows what waits. The highlighted step is next.
3. Each step says in one sentence what to do. Press **?** for the keys of the step.

## Flow A: from sudoku photos

Uploaded app scans and the photos of `just import-photos <folder>` go through the same steps.

| Step | What you do |
| --- | --- |
| 1 Fetch new scans | Pick the stage (`production` by default) and press Enter. The app finds the table and the bucket of the stage. An expired AWS session shows **Sign in to AWS**. |
| 2 Outlines | A gallery of the outlines to check, the most doubtful first. Click each bad outline. Enter approves the rest. Then each clicked photo opens large: drag the 4 corners and press Enter, or press R to reject the photo. |
| 3 Cells per scan | The photo beside its 9 × 9 cells. Each cell shows its digit and kind: the player's label for an app scan, the model's guess for an imported photo. A red dot marks a cell that the player corrected. Fix the wrong cells and press Enter. The next scan opens. |
| 4 Finish | See "Undo and Finish". |

No cell of a scan trains the model before a person approved its outline. A wrong outline makes
every cell label of the scan wrong. A cut again keeps the label of each place. A rejected app scan
moves all of its cells to `discarded/`.

A cell with the same pixels as a cell of another scan is stored once. It has one label for both
scans. The cells view dims it and names the other scan.

## Flow B: from loose cells

These are the cells in `unlabeled/` that no photo holds.

| Step | What you do |
| --- | --- |
| 1 Pre-label | The model guesses a digit and a kind for each loose cell. The server does this at its start. |
| 2 Digits | One gallery per digit, the least sure first. Click a wrong cell and type its digit. X discards a bad cut. Enter confirms the page. |
| 3 Kind | A page of cells of one digit without a kind. Press P or H for the page. Click each cell that differs. Enter saves the page. |
| 4 Doubtful labels | The app runs `just suspects` and lists the labels that the model or a near copy doubts. Fix the wrong ones. Enter keeps the rest. |
| 5 Finish | See "Undo and Finish". |

## Keys

| Key | What it does |
| --- | --- |
| Enter | Confirm the step: approve, save or confirm the page |
| Z | Undo the last change of this session |
| Esc | Go back |
| 0–9 | A digit. 0 is empty |
| P, H, U | Printed, handwritten, unsure |
| ? | Show the keys of the step |

## Stop at any time

Every Enter is saved at once in the journal. Press Ctrl-C whenever you want. Loose cells stay in
`unlabeled/`. Unchecked outlines stay unchecked. The next start continues where you stopped. The
journal of the old labelling page loads in the app as it is.

## Undo and Finish

- Press **Z** to undo your last change in this session. `just label-rollback <session>` reverses
  a whole session.
- Undo cannot reverse the approval or the rejection of an imported photo. It writes
  `sudoku-photos.csv` at once.
- **Finish folds the journal** into `ml/dataset/cells.csv`, runs the data check, writes
  `ml/dataset/STATUS.md`, and deletes the journal and the derived files.
- After Finish, Z can no longer undo these changes. Git keeps the old tables. A rollback of a
  finished session says: "This session is finished. Use git to go back."
- Finish closes every open doubtful label. Only new evidence opens one again.

## Where the data is

| Place | In git | What |
| --- | --- | --- |
| `ml/dataset/cells.csv` | Yes | One row per cell: `cell_id`, `digit`, `kind`, its source `photo_id`, `row`, `col`, and `label_source`. |
| `ml/dataset/sudoku-photos.csv` | Yes | One row per sudoku photo: `source`, `licence`, `attribution`, `status`, `corners`. |
| `ml/dataset/kind-checks.jsonl` | Yes | The answers of the old blind check. The doubtful labels still read them. |
| `ml/dataset/STATUS.md` | Yes | The counts of the last Finish. |
| `ml/dataset/images/cells/<digit>/`, `ml/dataset/images/sudoku-photos/` | No | The images. Do not delete them. `SUDOKU_IMAGES` can name another image store. |
| `ml/dataset/work/` | No | The journal (your unfinished work) and disposable files. Finish removes them. |

See [ml/dataset/README.md](dataset/README.md) for the details.

## Safety

- Do not run `just import-photos` while the app is open. Both write `sudoku-photos.csv`.
- If the image store is missing or wrong, the server refuses to start and changes no table.
  Check `SUDOKU_IMAGES` in `.env`. Only `just dataset-manifest --forget-missing` drops the rows of
  cells whose file is gone.
- A stop in the middle of a cut can leave some new cells without a link to their sudoku photo.
  The data check counts the cells without a link.

## Work on the app

- `pnpm --filter @sudoku/label-app test` runs the tests of the app.
- `pnpm --filter @sudoku/label-app dev` serves the app with hot reload on port 5173. Start the
  server on temporary data first, with `--port`, and pass the same port in `LABEL_SERVER_PORT`.
- Do not develop against the real data on port 8765.

## Git

Commit the tables after Finish: `git add ml/dataset` and `git commit -m "chore(data): ..."`.
Git never adds the images or `ml/dataset/work/`.

## Other commands

- `just check-data` checks that every cell and sudoku photo is unique and that the tables agree
  with the images.
- `just label-rollback <session>` reverses one unfinished labelling session.
- `just pull-scans <table> <bucket>` is the Fetch step without the app.
- The model guesses need a trained run in `ml/artifacts/`. Without it the app still works: you
  type each digit.
