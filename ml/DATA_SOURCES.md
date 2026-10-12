# Data sources

Every image in `ml/data/` comes from a source in this table (ADR-013). Do not use a source that
is not in this table.

Do not publish an image, a fixture or a model trained on a source whose "May be published" column
says no. Such a source may train models that stay private.

| Source | Images | Origin | Licence | May be published |
| --- | --- | --- | --- | --- |
| `photo` cells | Cells in `cells/` | Cut from the photos below. `cell-origins.csv` links a cut cell to its photo | The licence of its photo. A cell without a row in `cell-origins.csv`: as `phone` and `web` | Only if its photo may be published |
| Photos, `origin` = `phone` | Rows with this origin in `photos.csv` | Phone photos of puzzles printed in newspapers and books | The puzzles are copyrighted | No |
| Photos, `origin` = `web` | Rows with this origin in `photos.csv` | Downloaded from the web: stock-photo sites, shops, video thumbnails, forums | None | No |
| Photos, `origin` = `wicht` | Rows with this origin in `photos.csv` | [Wicht sudoku dataset v2](https://github.com/wichtounet/sudoku_dataset) | CC BY 4.0 | Yes, with the attribution in `photos.csv` |
| Photos, `origin` = `openverse` | Rows with this origin in `photos.csv` | Found through the Openverse API. The `attribution` column names the author and the page | Per photo, in `photos.csv` | Only `cc0`, `pdm`, `by` and `by-sa`, with the attribution |
| Photos, `origin` = `commons` | Rows with this origin in `photos.csv` | Wikimedia Commons | Per photo, in `photos.csv` | Only `cc0`, `pdm`, `by` and `by-sa`, with the attribution |
| Photos, `origin` = `lexski` | Rows with this origin in `photos.csv` | Hugging Face `Lexski/sudoku-image-recognition`. Tagged CC0, but the files look like Reddit uploads | `unverified` | No |
| Synthetic cells | Not stored | Rendered with the fonts in `ml/fonts/` | SIL Open Font License | Yes |

Training does not filter by licence yet. Until it does, every model trained on real cells stays private.
