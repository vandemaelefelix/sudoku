"""The jobs that the labelling app starts and that need the model: the pre-label of new cells, and
the ranking of suspects. label_server.py runs them from its buttons and at start."""

import pickle
from collections.abc import Collection
from pathlib import Path

from sudoku_ml.data_paths import ARTIFACTS, ML_ROOT, DataPaths


def prelabel_new_cells(
    paths: DataPaths,
    ml_root: Path = ML_ROOT,
    artifacts: Path = ARTIFACTS,
    wanted: Collection[str] | None = None,
) -> int:
    """Guess the `wanted` cells (full ids) with the latest model. Without `wanted`: all cells
    of unlabeled/ and the digit folders. Raises ValueError without a model or when it fails."""
    # torch loads slowly. Import it here so the server starts fast and the tests need no model.
    from sudoku_ml.prelabel import NO_MODEL, default_run, write_prelabels

    try:
        run = default_run(ml_root, artifacts)
    except (OSError, KeyError):
        run = None
    if run is None or not (run / "model.pt").exists():
        raise ValueError(NO_MODEL)
    try:
        return write_prelabels(paths.cells, run, paths.prelabels, wanted)
    except (OSError, RuntimeError, KeyError, EOFError, pickle.UnpicklingError) as error:
        raise ValueError(f"The pre-label failed: {error}") from error


def find_suspects(paths: DataPaths) -> None:
    # torch loads slowly, as in prelabel_new_cells.
    from sudoku_ml.suspects import find_suspects as rank

    rank(paths)
