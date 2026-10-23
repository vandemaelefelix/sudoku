# Notebooks

Two notebooks explain the ML pipeline step by step. They call the real functions of `sudoku_ml`.
They do not replace the commands: `just train` and `just export` stay the only way to make a
model.

| Notebook | What it shows |
| --- | --- |
| [01-sudoku-extraction.ipynb](01-sudoku-extraction.ipynb) | A photo → the grid outline → the flatten → 81 cell images → the model input → the prediction |
| [02-data-and-training.ipynb](02-data-and-training.ipynb) | The dataset and its trust rules, synthetic cells, augmentation, the split, the model, the loss, a small training run, calibration and the export |

Run `just notebooks` from the repository root. It opens JupyterLab in this folder. Notebook 2
trains a small model in about two minutes.

Do not commit outputs that show real images (SUD-08). Both notebooks use synthetic images by
default, so their committed outputs are safe. `USE_REAL_PHOTO` and `SHOW_REAL_CELLS` switch to
real images. Clear the outputs before you commit after you use them.
