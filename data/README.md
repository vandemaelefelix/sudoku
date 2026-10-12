# data

The real dataset of the cell classifier (ADR-018). The labelling tool writes it. Training reads it.

## What is where

| Path | In git | What |
| --- | --- | --- |
| `cells.csv` | Yes | One row per cell image: `cell_id,digit,kind,photo_id,row,col`. Sorted by digit, then by `cell_id`. |
| `sudoku-photos.csv` | Yes | One row per sudoku photo: `photo_id,file,source,licence,attribution,status,corners`. In import order. |
| `kind-checks.jsonl` | Yes | The answers of the blind Check. Append-only. The first answer creates it. |
| `STATUS.md` | Yes | A short summary that Finish writes. Do not edit it. |
| `images/cells/<digit>/<id16>.png` | No | The cell images. The folder is the digit: `1`-`9`, `empty`, `unlabeled` or `discarded`. |
| `images/sudoku-photos/<id16>.<ext>` | No | The sudoku photos. |
| `work/` | No | The journal (`journal.jsonl`) of the unfinished work, and derived files that the tool creates again. |

Do not delete `images/`. Until it has a backup, it holds the only copy of the images (R-04).

## The columns

- `cell_id`, `photo_id`: the SHA-256 of `<width>x<height>` followed by the RGB pixel bytes. The
  file name is the first 16 characters.
- `digit`: the folder of the cell.
- `kind`: `printed`, `handwritten`, `unsure`, or empty. It is empty for an `empty`, `unlabeled` or
  `discarded` cell, and for a digit cell without a kind.
- `photo_id`, `row`, `col`: the sudoku photo and the row and column (0-8) that the cell was cut
  from. All three are empty when the source is not known.
- `source`: `phone`, `web`, `wicht`, `openverse`, `commons` or `lexski`. `licence` and
  `attribution`: see [DATA_SOURCES.md](../ml/DATA_SOURCES.md).
- `status`: `pending`, `accepted`, `rejected`, `too-few-cells` or `legacy` (cut before photo
  checks existed).
- `corners`: for an `accepted` sudoku photo, the 4 corners `x1 y1 x2 y2 x3 y3 x4 y4` (top left,
  top right, bottom right, bottom left). Empty for the other statuses.

## One image store for all worktrees

Put this line in a git-ignored `.env` at the repository root:

```
SUDOKU_IMAGES=/path/to/the/image/store
```

The folder holds `cells/` and `sudoku-photos/`. A relative path starts at the repository root.
`just` reads `.env`, so every data command uses that store. Without it, the store is
`data/images/`. If the store is missing or a listed cell has no file, the tool refuses and
changes no table.

## Commands

- `just check-data`: check that the images and the tables agree.
- `just label-cells`: open the labelling page. See [LABELLING.md](../ml/LABELLING.md).
- `just migrate-layout <old_ml_root> [--apply]`: copy the old `ml/datasets/` and `ml/data/`
  layout into this folder.
