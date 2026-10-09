# Data sources

Every image in `ml/data/` comes from a source in this table (ADR-013). A source that is not in
this table MUST NOT be used.

Do not publish an image, a fixture or a model trained on a source whose "May be published"
column says no.

| Source | Images | Origin | Licence | May be published |
| --- | --- | --- | --- | --- |
| `legacy-v1` | 9,595 unique cells | Cut from the 2020 photos below, in the repository `vandemaelefelix/sudoku_solver` | Same as the photos they come from | No |
| `legacy-v2` | 7,821 unique cells | Cut from the photos of the 2025 project. Those photos were not kept, so their origin is unknown | Unknown | No |
| `legacy-v1` photos, phone | 212 photos | Phone photos from 2020 (`IMG_2020…`). The puzzles in them are printed in newspapers and books | Puzzles are copyrighted | No |
| `legacy-v1` and `legacy-v2` photos, web | 41 photos | Downloaded from the web: stock-photo sites, shops, video thumbnails, forums | None | No |

## Open decision

ADR-013 says the 2020 images are not used until their origin is established. The developer
decides whether the `legacy-v1` and `legacy-v2` cells may train **private** models. Until then,
training uses synthetic data only.
