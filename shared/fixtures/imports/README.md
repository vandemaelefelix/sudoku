# shared/fixtures/imports

Two images for the scan of an imported image (the still path, see the
[scan-pipeline concept](../../../docs/architecture/00-concepts/scan-pipeline.md)). Both show one puzzle of this project's
generator, so they are public-safe (ADR-013). They are not training data (SUD-10).

| File | What it shows |
| --- | --- |
| `screenshot-digital.png` | A screenshot of a digital sudoku, 1206 × 2622 like an iPhone screen. IBM Plex Sans (OFL) |
| `photo-paper.jpg` | A synthetic photo of a printed page on a table, 3024 × 4032, with a slant, light and noise. Merriweather (OFL) |

The puzzle is `000749251915283460004150000301020890002830076400690020680910700000305080007000000`. It has 40 givens and one
solution.

The paper photo shows the whole page. `findGrid` keeps only the outer contours, so it finds the page first. `locateStill`
then finds the grid inside the page. A port of the `findGrid` steps in Python OpenCV found the grid in both images.

Use them for the iPhone check: save both to the photo library, then scan them with the library button. The simulator has no
camera, so the end-to-end tests can scan them the same way.
