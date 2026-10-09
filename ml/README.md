# ml

Training, evaluation and export of the cell classifier. A standalone uv project. It shares only
files with the app: `contracts/`, `fixtures/` and the promoted model (SUD-07).

PyTorch arrives with issue #4.

## Data

Images live in `ml/data/` and are not in git. Their manifests live in `ml/datasets/` and are in
git, so every dataset version is exact and reviewable (ADR-009).

```
ml/data/
├── cells/
│   ├── empty/  1/ … 9/        one folder per digit class of the model contract
│   └── unlabeled/             no known label, or sources that disagree
└── photos/                    full sudoku photos
ml/datasets/
├── cells.csv                  id, label
└── photos.csv                 id, file, sources (where each photo came from, ADR-013)
```

- An image's `id` is the SHA-256 of its size and decoded RGB pixels. The file name is the first
  16 characters of the id. The same image is never stored twice.
- `cells.csv` must match the folders: a cell's label is the folder it is in.
- `photos.csv` lists, per photo, every original file that had these exact pixels.
- Cells carry a digit label only. The kind (printed, handwritten, notes) is labelled later
  (ADR-006).

### Where the current data came from

A one-time script imported the earlier projects on 2026-10-09. It was removed after the import:

| Source | Images | Unique after import |
| --- | --- | --- |
| 2020 repository, `numbers/` and `printed_digits/` | 20,885 cells | 16,277 cells in total, of which 71 unlabeled (67 noise, 4 conflicting labels) |
| 2025 project, `data/digits/` | 7,821 cells | (included above) |
| 2020 repository, `trained_sudokus/` and `images_handwritten/`, 2025 skipped photos | 257 photos | 253 photos |

The sources stay available: the 2020 data on GitHub (`vandemaelefelix/sudoku_solver`), the 2025
cells in the old local project.
