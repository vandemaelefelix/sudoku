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
│   └── unlabeled/             cells that still need a label
└── photos/                    full sudoku photos
ml/datasets/
├── cells.csv                  id, label, kind
├── photos.csv                 id, file, origin
├── kind-log.jsonl             every kind and digit change, append-only
└── kind-check.jsonl           blind check answers
```

- The `id` of an image is the SHA-256 of the text `<width>x<height>` followed by the image's
  RGB pixel bytes, row by row. The file name is the first 16 characters of the id. The folders
  hold each image once.
- The label of a cell is the folder it is in. `cells.csv` must match the folders.
- `origin` in `photos.csv` is `phone` or `web` (see DATA_SOURCES.md).
- The kind of a cell comes from `kind-log.jsonl` (ADR-009, amendment). `printed` means made by
  a printer or a screen. `handwritten` means written by a person. Undecidable cells are `unsure`.

The dataset holds 16,277 cells and 253 photos. 71 cells have no label yet: 67 hold notes or other
marks, and 4 need a check by hand.

## Label the kind

1. Run `just group-cells`. It groups the cells of each digit folder.
2. Run `just label-cells`. The page opens in the browser.
3. On the Groups screen, press P or H for the whole screen. Click the exceptions. Press Enter.
4. After a labelling pass, run `just suspects`. Then work through the Review screen.
5. At least 7 days later, run the Check screen. It shows how often you agree with your labels.

Stop the server with Ctrl-C. `just label-cells` rewrites `cells.csv` before and after.
Commit `ml/datasets/kind-log.jsonl`, `kind-check.jsonl` and `cells.csv` after a session.
