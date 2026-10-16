# Labelling tool

A local page to turn sudoku photos into labelled cells. It runs on your Mac only (SUD-02).
A **sudoku photo** is a photo of a whole sudoku. A **cell** is one square cut from it.

## Run

1. `just import-photos <folder>` copies new sudoku photos into the image store. A scraper folder
   with a `manifest.jsonl` needs no options. For other photos add `--source <s> --licence <l>`.
2. `just label-cells` opens the page at `http://127.0.0.1:8765/`.
3. Work through the three steps at the top. The yellow line on each screen says what to do.
4. Press **Finish** when you are done. Then commit the tables (see "Git").

## The three steps

| Step | What you do |
| --- | --- |
| 1 Check photos | Check the grid outline of each sudoku photo. Accept it, fix the 4 corners, reject it, or skip it. |
| 2 Confirm digits | The model proposes a digit for each cell. Click the wrong ones. Press Enter. |
| 3 Label kind | A screen shows only the cells without a kind. The model proposes printed or handwritten. Click the wrong ones. Press Enter. **Look again** on the Progress page shows all cells of a folder. |

Tools: **Review** shows doubtful labels (run `just suspects` first). **Check** is a blind re-test
of your labels. **Progress** shows what is left.

## Stop at any time

Every Enter and every accept is saved at once in the journal. Press Ctrl-C whenever you want.
Unlabelled cells stay in `unlabeled/`. Pending sudoku photos stay pending. Next start continues
where you stopped.

## Undo and Finish

- Press **Z** to undo your last change in this session. `just label-rollback <session>` reverses
  a whole session.
- Undo and rollback work only on the journal: the changes since the last Finish.
- **Finish folds the journal** into `ml/dataset/cells.csv`, runs the data check, writes
  `ml/dataset/STATUS.md`, and deletes the journal and the derived files.
- After Finish, Z can no longer undo these changes. Git keeps the old tables. A rollback of a
  finished session says: "This session is finished. Use git to go back."
- Finish closes every open Review item. Only new evidence opens one again.
- "Digit corrected" on the Progress page counts the unfinished work only. Finish sets it to 0.

## Where the data is

| Place | In git | What |
| --- | --- | --- |
| `ml/dataset/cells.csv` | Yes | One row per cell: `cell_id`, `digit`, `kind`, and its source `photo_id`, `row`, `col`. |
| `ml/dataset/sudoku-photos.csv` | Yes | One row per sudoku photo: `source`, `licence`, `attribution`, `status`, `corners`. |
| `ml/dataset/kind-checks.jsonl` | Yes | The answers of the blind Check. |
| `ml/dataset/STATUS.md` | Yes | The counts of the last Finish. |
| `ml/dataset/images/cells/<digit>/`, `ml/dataset/images/sudoku-photos/` | No | The images. Do not delete them. `SUDOKU_IMAGES` can name another image store. |
| `ml/dataset/work/` | No | The journal (your unfinished work) and disposable files. Finish removes them. |

See [ml/dataset/README.md](dataset/README.md) for the details.

## Safety

- Do not run `just import-photos` while the page is open. Both write `sudoku-photos.csv`.
- If the image store is missing or wrong, the tool refuses to start and changes no table. Check
  `SUDOKU_IMAGES` in `.env`. Only `just dataset-manifest --forget-missing` drops the rows of
  cells whose file is gone.
- A stop in the middle of a cut can leave some new cells without a link to their sudoku photo.
  The data check counts the cells without a link.

## After the migration to ml/dataset/

- `just migrate-layout` closes every open Review item. Run `just suspects` to find new ones.
- The groups are not migrated. Run `just group-cells` again.

## Git

Commit the tables after Finish: `git add ml/dataset` and `git commit -m "chore(data): ..."`.
Git never adds the images or `ml/dataset/work/`.

## Other commands

- `just check-data` checks that every cell and sudoku photo is unique and that the tables agree
  with the images.
- `just label-rollback <session>` reverses one unfinished labelling session.
- The model guesses need a trained run in `ml/artifacts/`. Without it the tool still works.
