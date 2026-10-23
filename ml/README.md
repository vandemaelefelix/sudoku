# ml

Run `just label-cells` and follow the start page.

Training, evaluation and export of the cell classifier. A standalone uv project. It shares only
files with the app: `shared/model-contract/`, `shared/fixtures/` and the promoted model (SUD-07).

The labelling app has its own short guide: [LABELLING.md](LABELLING.md).

## Commands

Run these from the repository root. Run `just --list` for all commands.

- `just train [config]`: train the two-head classifier. A run writes to `ml/artifacts/`.
- `just export <run>`: export a run to TFLite. The run path is relative to `ml/`, for example `just export artifacts/<run>`.
- `just preprocess-fixtures`: regenerate the synthetic reference pairs in `shared/fixtures/preprocess/`. This overwrites the committed files. The app tests against the same files.
- `just dataset-manifest [--forget-missing]`: rewrite `ml/dataset/cells.csv` from the cell folders and the journal. It refuses a missing or wrong image store. `--forget-missing` drops the rows of cells whose file is gone.
- `just suspects`: rank the cells whose digit or kind label the model doubts most. The start page of the labelling app has a tool for them. The app runs it too.
- `just import-photos <folder> [--source S] [--licence L]`: copy new sudoku photos into the image store and find the grid in each.
- `just prelabel-cells [run]`: let a model propose a digit and a kind, with the full probabilities, for each cell in `unlabeled/` and the digit folders. The labelling app does this by itself, for the open cells.
- `just label-cells`: build the labelling app if needed and open it on 127.0.0.1 (ADR-034).
- `just label-rollback <session>`: reverse every change of one unfinished labelling session. A finished session needs git.
- `just relabel <file>`: move cells to the digits in a relabel CSV (header `file,new_label`).
- `just check-data`: check that the images and the tables agree. Exit code 1 on a problem.
- `just reset-scan-outlines`: set the uploaded scans with the status `accepted` back to `unchecked`. Run it once, for the scans of the first pull.

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

## Label cells

Run `just label-cells` and follow the start page. [LABELLING.md](LABELLING.md) describes the one
flow of the labelling app: fetch the uploaded scans, check the outline of each scan and imported
photo, confirm the digit of each open cell, confirm its kind, then press **Finish**. Both cell
steps show the most doubtful cell first (ADR-030). Finish folds the journal into `cells.csv`,
checks the data, writes `ml/dataset/STATUS.md` and deletes the journal and the derived files in
`ml/dataset/work/`. Then commit the tables: `git add ml/dataset` and commit. Git never adds the
images or `ml/dataset/work/`.

The app works on the real data in `ml/dataset/` and the image store. It has no scratch copy. You
can stop at any time: Ctrl-C, a closed terminal or a crash. Every label you saved stays in the
journal. The next start repairs what the stop left and deletes leftover files in
`ml/dataset/work/tmp/`.

No cell of an uploaded scan trains the model before a person approves its outline and verifies
its label. Training takes only `verified` cells and legacy cells without a label provenance. A
wrong outline makes every cell label of the scan wrong. Run `just reset-scan-outlines` once for the scans of the
first pull: they were stored as `accepted` before the outline check existed. The command refuses
while the journal holds an unfinished outline check.

Every cell and sudoku photo has a SHA-256 pixel id, and no id appears twice. Run
`just check-data` to test this. It also tests that the tables match the files and follow their
rules. It prints a short report and exits with 1 on a problem. The report says how many cells
are linked to their sudoku photo, row and column. Cells cut before the link existed have no
link.
