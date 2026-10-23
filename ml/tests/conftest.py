from collections.abc import Callable

import pytest
from cells import Clock

from sudoku_ml.data_paths import IMAGES_ENV, DataPaths
from sudoku_ml.label_store import LabelStore


@pytest.fixture(autouse=True)
def no_shared_images(monkeypatch):
    # `just` loads .env, which can point SUDOKU_IMAGES at the real image store.
    monkeypatch.delenv(IMAGES_ENV, raising=False)


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def make_store(clock: Clock) -> Callable[[DataPaths], LabelStore]:
    """A label store with the shared clock. Each call is one process that opens the dataset."""
    return lambda paths: LabelStore(paths, clock)
