# Labelling app

Run `just label-cells` and follow the start page.

The labelling app turns sudoku photos and loose cells into verified cells. It runs on your Mac
only, on 127.0.0.1 (SUD-02). A **sudoku photo** is a photo of a whole sudoku. A **cell** is one
square cut from it. The app lives in `tools/label-app/`. The Python label server holds the data
(ADR-034).

## Run

1. `just label-cells` builds the app when a source changed. Then it starts the server and opens
   `http://127.0.0.1:8765/`. `just label-cells port=8799` uses another port.
2. The start page shows the steps of the one flow. Each step shows what waits. The highlighted
   step is next. The start page also has the tool for doubtful older labels (`just suspects`). It
   is outside the flow.
3. Each step says in one sentence what to do. Press **?** for the keys of the step.

## The flow

Uploaded app scans, imported photos (`just import-photos <folder>`) and loose cells go through the
same steps. A **loose cell** is a cell in `unlabeled/` that no photo holds. Its side panel says
"no photo".

The model guesses every open cell by itself: at the start of the server, after a fetch and after
each approved outline. The start page shows a line when no model is installed. Then the cells have
no order.

| Step | What you do |
| --- | --- |
| 1 Fetch new scans | Pick the stage (`production` by default) and press Enter. The app finds the table and the bucket of the stage. An expired AWS session shows **Sign in to AWS**. |
| 2 Outlines | A gallery of the outlines to check, the most doubtful first. Click each bad outline. Enter approves the rest. Then each clicked photo opens large: drag the 4 corners and press Enter, or press R to reject the photo. |
| 3 Digits | The open digit cells, one gallery per tab (Empty, 1 to 9, and No guess). The most doubtful cell comes first. A cell sits in the tab of its label: yours for an app scan, the model's for an imported photo or a loose cell. Point at a cell: the side panel shows its whole sudoku with the cell marked, the cell large, its label, the model's probabilities, the reasons for the doubt and your fix. Click a cell to select it, type a digit to fix the selection, and press X to discard a bad cut. Enter confirms the page. **Confirm the sure ones** confirms every cell of the tab that the model reads as labelled with at least the threshold (98 %). |
| 4 Kind | The cells of 1 to 9 whose digit you confirmed, and the cells without a kind. One gallery per digit, the most doubtful first. Press P, H or U for the selected cells. Enter confirms the page. **Confirm the sure ones** uses the threshold of 95 %. Kind tabs under the digit tabs (All, Printed, Handwritten, Unsure) show one kind, to spot an outlier. Enter and the sure button act on the shown kind only. |
| 5 Finish | See "Undo and Finish". |

A tile edge runs from red (doubtful) to green (sure). The reasons name each signal: a low
probability, a model that reads another digit or kind, a label that the player changed, a digit
twice in a row, a column or a box, and printed givens with more than one solution. The signals only
set the order. You still check every cell. [Scan collection](../docs/architecture/00-concepts/scan-collection.md)
holds the formula.

No cell of a scan trains the model before a person approved its outline. A wrong outline makes
every cell label of the scan wrong. A cut again keeps the label of each place. A rejected app scan
moves all of its cells to `discarded/`. Training uses only the cells that a person verified.
Finish writes `verified` for each cell that you confirmed.

A cell with the same pixels as a cell of another scan is stored once. It has one label for both
scans, and it shows once in the gallery.

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

Every Enter is saved at once in the journal. Press Ctrl-C whenever you want. Open cells stay
where they are. Unchecked outlines stay unchecked. The next start continues where you stopped. The
journal of the old labelling page loads in the app as it is.

## Undo and Finish

- Press **Z** to undo your last change in this session. `just label-rollback <session>` reverses
  a whole session.
- Undo cannot reverse the approval or the rejection of an imported photo. It writes
  `sudoku-photos.csv` at once.
- **Finish folds the journal** into `ml/dataset/cells.csv`, runs the data check, writes
  `ml/dataset/STATUS.md`, and deletes the journal and the derived files.
- **Finish refuses while cells wait in the Kind step.** It stops before it writes anything and says how many
  cells wait. The Finish step shows the count and an **Open Kind** button. Finish stays disabled until the Kind step
  is done.
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
- The model guesses need a trained run in `ml/artifacts/`. Without it the app still works: the
  cells have no order and you type each digit.
