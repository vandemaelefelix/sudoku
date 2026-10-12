# Data sources

Every image in the image store (`data/images/`, or the folder that `SUDOKU_IMAGES` names) comes
from a source in this table (ADR-013, ADR-018). Do not use a source that
is not in this table.

Do not publish an image, a fixture or a model trained on a source whose "May be published" column
says no. Such a source may train models that stay private.

| Source | Images | Where from | Licence | May be published |
| --- | --- | --- | --- | --- |
| `photo` cells | Cells in `cells/` | Cut from the sudoku photos below. The columns `photo_id`, `row` and `col` of `data/cells.csv` link a cut cell to its sudoku photo | The licence of its sudoku photo. A cell without a `photo_id`: as `phone` and `web` | Only if its sudoku photo may be published |
| Sudoku photos, `source` = `phone` | Rows with this source in `data/sudoku-photos.csv` | Phone photos of puzzles printed in newspapers and books | The puzzles are copyrighted | No |
| Sudoku photos, `source` = `web` | Rows with this source in `data/sudoku-photos.csv` | Downloaded from the web: stock-photo sites, shops, video thumbnails, forums | None | No |
| Sudoku photos, `source` = `wicht` | Rows with this source in `data/sudoku-photos.csv` | [Wicht sudoku dataset v2](https://github.com/wichtounet/sudoku_dataset) | CC BY 4.0 | Yes, with the attribution in `sudoku-photos.csv` |
| Sudoku photos, `source` = `openverse` | Rows with this source in `data/sudoku-photos.csv` | Found through the Openverse API. The `attribution` column names the author and the page | Per photo, in `sudoku-photos.csv` | Only `cc0`, `pdm`, `by` and `by-sa`, with the attribution |
| Sudoku photos, `source` = `commons` | Rows with this source in `data/sudoku-photos.csv` | Wikimedia Commons | Per photo, in `sudoku-photos.csv` | Only `cc0`, `pdm`, `by` and `by-sa`, with the attribution |
| Sudoku photos, `source` = `lexski` | Rows with this source in `data/sudoku-photos.csv` | Hugging Face `Lexski/sudoku-image-recognition`. Tagged CC0, but the files look like Reddit uploads | `unverified` | No |
| Synthetic cells | Not stored | Rendered with the fonts in `ml/fonts/` | SIL Open Font License | Yes |

The `licence` column of `sudoku-photos.csv` holds the licence of each sudoku photo. Training does not filter by licence yet. Until it does, every model trained on real cells stays private.
