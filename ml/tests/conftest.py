import pytest

from sudoku_ml.data_paths import IMAGES_ENV


@pytest.fixture(autouse=True)
def no_shared_images(monkeypatch):
    # `just` loads .env, which can point SUDOKU_IMAGES at the real image store.
    monkeypatch.delenv(IMAGES_ENV, raising=False)
