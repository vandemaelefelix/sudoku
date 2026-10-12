# ml

Training, evaluation and export of the cell classifier. A standalone uv project. It shares only
files with the app: `contracts/`, `fixtures/` and the promoted model (SUD-07).

## Commands

Run these from the repository root. Run `just --list` for all commands.

- `just train [config]`: train the two-head classifier. A run writes to `ml/artifacts/`.
- `just export <run>`: export a run to TFLite. The run path is relative to `ml/`, for example `just export artifacts/<run>`.
- `just preprocess-fixtures`: regenerate the synthetic reference pairs in `fixtures/preprocess/`. This overwrites the committed files. The app tests against the same files.
- `just dataset-manifest`: rewrite `ml/datasets/cells.csv` from the folders.
- `just suspects`: rank the cells whose digit or kind label the model doubts most. The Review screen shows them.
- `just group-cells [run]`: group similar cells per digit folder for the labelling page.
- `just import-photos <folder> [--origin O] [--licence L]`: copy new sudoku photos into `ml/data/photos/` and find the grid in each.
- `just prelabel-cells [run]`: let a model propose a digit and a kind for each cell in `unlabeled/` and a kind for each cell in the digit folders. `just label-cells` runs it first.
- `just label-cells`: open the labelling page on 127.0.0.1.
- `just label-rollback <session>`: reverse every change of one labelling session.
- `just relabel [file]`: apply the labels from a relabel CSV to the cells.

Runs land in `ml/artifacts/`. This folder is not in git. A model trained with `real_cells = true`
stays private (ADR-013).

## Data

Do not delete `ml/data/`. Until it has a backup, it holds the only copy of the images.

Images live in `ml/data/` and are not in git. Their manifests live in `ml/datasets/` and are in
git, so every dataset version is exact and reviewable (ADR-009). Where the images come from, and
what they may be used for, is in [DATA_SOURCES.md](DATA_SOURCES.md).

```
ml/data/
├── cells/
│   ├── empty/  1/ … 9/        one folder per digit class of the model contract
│   ├── unlabeled/             cells that still need a label
│   └── discarded/             cells a person rejected; training ignores them
├── photos/                    full sudoku photos
└── work/                      derived files; outside git; safe to delete at any time
    ├── prelabels.json         the model's proposals: digit, kind and how sure it is of the kind
    ├── detections.json        the proposed outline per pending photo
    ├── suspects.csv           the likely wrong labels, from just suspects
    ├── groups.json            the groups of cells, from just group-cells
    └── tmp/                   cells being cut; the next start deletes leftovers
ml/datasets/
├── cells.csv                  id, label, kind
├── photos.csv                 id, file, origin, licence, attribution
├── photo-checks.jsonl         one line per photo decision
├── cell-origins.csv           cell, photo, row, col
├── kind-log.jsonl             every kind and digit change, append-only
└── kind-check.jsonl           blind check answers
```

- The `id` of an image is the SHA-256 of the text `<width>x<height>` followed by the image's
  RGB pixel bytes, row by row. The file name is the first 16 characters of the id. The folders
  hold each image once.
- The label of a cell is the folder it is in. `cells.csv` must match the folders.
- `origin` and `licence` in `photos.csv` say where a photo comes from and how it may be used (see DATA_SOURCES.md).
- The kind of a cell comes from `kind-log.jsonl` (ADR-009, amendment). `printed` means made by
  a printer or a screen. `handwritten` means written by a person. Undecidable cells are `unsure`.

The files `photos.csv` and `cells.csv` list every photo and every cell. Count their rows to get
the size of the dataset.

## Import photos and label their digits

1. Run `just import-photos <folder> --origin phone --licence own`. A folder from the sudoku
   paper scraper has a `manifest.jsonl`, so it needs no options.
2. Run `just label-cells`. Open the **Photos** screen. Accept each photo, fix its 4 corners or
   reject it. Accepted photos give cells in `cells/unlabeled/`.
3. Stop the server with Ctrl-C. Run `just label-cells` again. It pre-labels the new cells.
4. Open the **Digits** screen. Click the cells that are not the digit in the title. Press Enter.
5. Label the kind of the new cells on the Groups screen, as below.

Commit `ml/datasets/photos.csv`, `photo-checks.jsonl`, `cell-origins.csv`, `kind-log.jsonl` and
`cells.csv` after a session.

## Label the kind

1. Run `just group-cells`. It groups the cells of each digit folder.
2. Run `just label-cells`. The page opens in the browser.
3. On the Groups screen, press P or H for the whole screen. Click the exceptions. Press Enter.
   New cells that no stored group holds start with the model's guess. The groups are
   "printed", "handwritten" and "other". The least sure cells come first. Click only the cells
   that are wrong, then press Enter. In the "other" group, press P or H first.
4. After a labelling pass, run `just suspects`. Then work through the Review screen.
5. At least 7 days later, run the Check screen. It shows how often you agree with your labels.

Stop the server with Ctrl-C. The server then rewrites `cells.csv`, so training sees the new labels.
Commit `ml/datasets/kind-log.jsonl`, `kind-check.jsonl` and `cells.csv` after a session.
