# ml

Training, evaluation and export of the cell classifier. A standalone uv project. It shares only
files with the app: `shared/model-contract/`, `shared/fixtures/` and the promoted model (SUD-07).

The labelling tool has its own short guide: [LABELLING.md](LABELLING.md).

## Commands

Run these from the repository root. Run `just --list` for all commands.

- `just train [config]`: train the two-head classifier. A run writes to `ml/artifacts/`.
- `just export <run>`: export a run to TFLite. The run path is relative to `ml/`, for example `just export artifacts/<run>`.
- `just preprocess-fixtures`: regenerate the synthetic reference pairs in `shared/fixtures/preprocess/`. This overwrites the committed files. The app tests against the same files.
- `just dataset-manifest [--forget-missing]`: rewrite `ml/dataset/cells.csv` from the cell folders and the journal. It refuses a missing or wrong image store. `--forget-missing` drops the rows of cells whose file is gone.
- `just suspects`: rank the cells whose digit or kind label the model doubts most. The Review screen shows them.
- `just group-cells [run]`: group similar cells per digit folder for the labelling page.
- `just import-photos <folder> [--source S] [--licence L]`: copy new sudoku photos into the image store and find the grid in each.
- `just prelabel-cells [run]`: let a model propose a digit and a kind for each cell in `unlabeled/` and a kind for each cell in the digit folders. `just label-cells` runs it first.
- `just label-cells`: open the labelling page on 127.0.0.1.
- `just label-rollback <session>`: reverse every change of one unfinished labelling session. A finished session needs git.
- `just relabel <file>`: move cells to the digits in a relabel CSV (header `file,new_label`).
- `just check-data`: check that the images and the tables agree. Exit code 1 on a problem.
- `just doubt-cells [run]`: score the doubt of each open cell of the uploaded scans, for the Check cells screen.
- `just reset-scan-outlines`: set the uploaded scans with the status `accepted` back to `unchecked`. Run it once, for the scans of the first pull.
- `just migrate-layout <old_ml_root> [--apply] [--force] [--prefer-log]`: copy the old `ml/datasets/` and `ml/data/` layout into `ml/dataset/` (ADR-018). A dry run without `--apply`.

Runs land in `ml/artifacts/`. This folder is not in git. A model trained with `real_cells = true`
stays private (ADR-013).

## Data

Do not delete the image store. Until it has a backup, it holds the only copy of the images.

The real dataset lives in `ml/dataset/` (ADR-018). [ml/dataset/README.md](dataset/README.md)
says what is where and what is in git. The images are not in git. The two tables are in git, so
every dataset version is exact and reviewable. Where the images come from, and what they may be
used for, is in [DATA_SOURCES.md](DATA_SOURCES.md).

- The `cell_id` and the `photo_id` are the SHA-256 of the text `<width>x<height>` followed by the
  image's RGB pixel bytes, row by row. The file name is the first 16 characters of the id. The
  folders hold each image once.
- The digit of a cell is the folder it is in. The `digit` column of `cells.csv` must match it.
- The kind of a digit cell is `printed` (made by a printer or a screen), `handwritten` (written by
  a person) or `unsure` (undecidable). Training ignores `unsure`.
- `source` and `licence` in `sudoku-photos.csv` say where a sudoku photo comes from and how it
  may be used.
- The model runs stay in `ml/artifacts/`, outside git.

Count the rows of `cells.csv` and `sudoku-photos.csv` to get the size of the dataset.
`ml/dataset/STATUS.md` holds the counts of the last Finish.

## Import photos and label their digits

1. Run `just import-photos <folder> --source phone --licence own`. A folder from the sudoku
   paper scraper has a `manifest.jsonl`, so it needs no options.
2. Run `just label-cells`. Open the **Photos** screen. Accept each sudoku photo, fix its 4
   corners or reject it. Accepted sudoku photos give cells in `cells/unlabeled/`.
3. Press **Pre-label new cells** on the Digits screen. The next start of `just label-cells` also
   pre-labels the new cells.
4. Open the **Digits** screen. Click the cells that are not the digit in the title. Press Enter.
5. Label the kind of the new cells on the Groups screen, as below.

6. Press **Finish** in the header. Finish folds the journal into `cells.csv`, checks the data,
   writes `ml/dataset/STATUS.md` and deletes the journal and the derived files in `ml/dataset/work/`. It is
   safe to press twice. Your unlabelled cells and pending sudoku photos stay. After Finish, Z
   can no longer undo the finished changes. Git keeps the old tables.
7. Commit the tables: `git add ml/dataset` and commit. Git never adds the images or `ml/dataset/work/`.

The tool works on the real data in `ml/dataset/` and the image store. It has no scratch copy. You can
stop at any time: Ctrl-C, a closed terminal or a crash. Every label you saved stays in the
journal. Unlabelled cells stay in `cells/unlabeled/`. Pending sudoku photos stay pending. The next
start repairs what the stop left, deletes leftover files in `ml/dataset/work/tmp/` and prints how many
cells and sudoku photos wait.

Every cell and sudoku photo has a SHA-256 pixel id, and no id appears twice. Run
`just check-data` to test this. It also tests that the tables match the files and follow their
rules. It prints a short report and exits with 1 on a problem. The report says how many cells
are linked to their sudoku photo, row and column. Cells cut before the link existed have no
link.

## Check the outlines of uploaded scans

`just pull-scans` stores each uploaded scan with the status `unchecked`, and cuts its 81 cells into the digit folders
with the label from the app: `app-edited` or `app-unedited`. No cell of a scan trains the model before a person
approves its outline. A wrong outline makes every cell label of the scan wrong.

1. Run `just label-cells`. Open **Check outlines** under "Uploaded scans". The badge counts the outlines to check.
2. The gallery shows each scan with its outline in green. The most doubtful outlines come first: the fit says how
   well the grid lines sit at the 9 × 9 places.
3. Click each scan whose outline is not on the grid. Press Enter. The other scans are approved.
4. The clicked scans open large, one at a time. Drag the 4 corners onto the outer grid corners. Press Enter. The page
   cuts the 81 cells again. A new cell keeps the digit and kind of its place, from the app. The old cells move to
   `discarded/`.
5. No sudoku, or no fit? Press R to reject the scan. All of its cells move to `discarded/`, so training leaves them out.
6. Press V to see the cells of a scan. Press Z to undo the last Enter, fix or reject.
7. Open **Check cells**, as below.
8. Press **Finish**. Finish writes `accepted` or `rejected` and the corners into `sudoku-photos.csv`.

A cell with the same pixels as a cell of another scan is stored once. It has one label for both scans. The scan view
marks it with `=`.

Run `just reset-scan-outlines` once after this change. The first pull stored its scans as `accepted`, before the
Check outlines screen existed. The command sets them back to `unchecked`. It refuses while the journal holds an unfinished
outline check.

## Check the cells of uploaded scans

No cell of a scan trains the model before a person verifies it. Training takes only `verified` cells and the legacy
cells without a label source.

1. Open **Check cells** under "Uploaded scans". It shows the open cells of one digit. The digit bar shows the open
   cells of each digit.
2. The most doubtful cells come first. The note on a cell says why. Point at a cell to read the full reason.
3. Digit wrong? Point at the cell and press the right digit. 0 means empty. X discards a bad cut.
4. Kind wrong? Click the cell to switch between printed and handwritten. ⌥-click for unsure.
5. Press Enter. Every cell on the screen is verified, with your changes. Press V to see the scan of a cell.
6. Press **Finish**. Finish writes `verified` into `cells.csv`.

The doubt score comes from the player's edit, the model, the sudoku rules and the solutions of the printed digits.
`ml/dataset/work/doubt.json` holds it. The label server scores at its start when the model changed or an open cell has
no score. The **Score cells** button and `just doubt-cells` do the same.

## Label the kind

1. Run `just group-cells`. It groups the cells of each digit folder.
2. Run `just label-cells`. The page opens in the browser.
3. On the Groups screen, press P or H for the whole screen. Click the exceptions. Press Enter.
   New cells that no stored group holds start with the model's guess. The groups are
   "printed", "handwritten" and "other". The least sure cells come first. Click only the cells
   that are wrong, then press Enter. In the "other" group, press P or H first.
4. After a labelling pass, run `just suspects`. Then work through the Review screen.
5. At least 7 days later, run the Check screen. It shows how often you agree with your labels.
   A kind from `cells.csv` (finished) counts as old enough.

Stop the server with Ctrl-C. The server then rewrites `cells.csv`, so training sees the new labels.
Press Finish at the end of a session. Then commit `ml/dataset/`: `cells.csv`, `sudoku-photos.csv`,
`kind-checks.jsonl` and `STATUS.md`.
