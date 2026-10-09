# Data sources

Every image in `ml/data/` comes from a source in this table (ADR-013). Do not use a source that
is not in this table.

Do not publish an image, a fixture or a model trained on a source whose "May be published" column
says no. Such a source may train models that stay private.

| Source | Images | Origin | Licence | May be published |
| --- | --- | --- | --- | --- |
| `photo` cells | 16,277 cells in `cells/` | Cut from sudoku photos, of the same origins as the photos below | Same as the photos | No |
| Photos, `origin` = `phone` | 212 photos in `photos/` | Phone photos of puzzles printed in newspapers and books | The puzzles are copyrighted | No |
| Photos, `origin` = `web` | 41 photos in `photos/` | Downloaded from the web: stock-photo sites, shops, video thumbnails, forums | None | No |
| Synthetic cells | Not stored | Rendered with the fonts in `ml/fonts/` | SIL Open Font License | Yes |
