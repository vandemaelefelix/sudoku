# ml

Training, evaluation and export of the cell classifier. A standalone uv project. It shares only
files with the app: `contracts/`, `fixtures/` and the promoted model (SUD-07).

## Commands

Run these from the repository root. Run `just --list` for all commands.

- `just train [config]`: train the two-head classifier. A run writes to `ml/artifacts/`.
- `just export <run>`: export a run to TFLite. The run path is relative to `ml/`, for example `just export artifacts/<run>`.
- `just preprocess-fixtures`: turn the fixtures into model input.
- `just dataset-manifest`: rewrite `ml/datasets/cells.csv` from the folders.
- `just suspects`: rank the cells whose label the model doubts most.
- `just relabel [file]`: apply the reviewed labels from a file to the cells.

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
├── cells.csv                  id, label
└── photos.csv                 id, file, origin
```

- The `id` of an image is the SHA-256 of the text `<width>x<height>` followed by the image's
  RGB pixel bytes, row by row. The file name is the first 16 characters of the id. The folders
  hold each image once.
- The label of a cell is the folder it is in. `cells.csv` must match the folders.
- `origin` in `photos.csv` is `phone` or `web` (see DATA_SOURCES.md).
- Cells carry a digit label only. The kind (printed, handwritten, notes) gets a label later
  (ADR-006).

The dataset holds 16,277 cells and 253 photos. 71 cells have no label yet: 67 hold notes or other
marks, and 4 need a check by hand.
