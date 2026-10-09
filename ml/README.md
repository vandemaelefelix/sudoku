# ml

Training, evaluation and export of the cell classifier. A standalone uv project. It shares only
files with the app: `contracts/`, `fixtures/` and the promoted model (SUD-07).

PyTorch arrives with issue #4.

## Data

Do not delete `ml/data/`. Until it has a backup, it holds the only copy of the cleaned images.

Images live in `ml/data/` and are not in git. Their manifests live in `ml/datasets/` and are in
git, so every dataset version is exact and reviewable (ADR-009). Where each source comes from,
and what it may be used for, is in [DATA_SOURCES.md](DATA_SOURCES.md).

```
ml/data/
├── cells/
│   ├── empty/  1/ … 9/        one folder per digit class of the model contract
│   └── unlabeled/             cells without a known label
└── photos/                    full sudoku photos
ml/datasets/
├── cells.csv                  id, label, sources
└── photos.csv                 id, file, sources
```

- The `id` of an image is the SHA-256 of the text `<width>x<height>` followed by the image's
  RGB pixel bytes, row by row. The file name is the first 16 characters of the id. The folders
  hold each image once.
- The label of a cell is the folder it is in. `cells.csv` must match the folders.
- `sources` in `cells.csv` names the sources that held the cell: `legacy-v1`, `legacy-v2`, or
  both, separated by `;`.
- `sources` in `photos.csv` lists the original files that held the photo, separated by `;`.
- Cells carry a digit label only. The kind (printed, handwritten, notes) gets a label later
  (ADR-006).

### Where the current data came from

A one-time script imported the earlier projects on 2026-10-09. The script is not kept.

| Source | Before | After |
| --- | --- | --- |
| `legacy-v1`: the 2020 repository `vandemaelefelix/sudoku_solver` | 20,885 cells | 9,595 unique cells |
| `legacy-v2`: the 2025 project (`~/projects/sudoku_solver` on the developer's Mac) | 7,821 cells | 7,821 unique cells |
| Both together | 28,706 cells | 16,277 unique cells (1,139 cells are in both) |
| Photos from both | 257 photos | 253 unique photos |

71 cells have no label. 67 are noise cells (label `10` in `legacy-v2`). 4 cells had sources
that disagree on the label.
