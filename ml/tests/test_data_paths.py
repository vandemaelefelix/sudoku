from pathlib import Path

from sudoku_ml.data_paths import DATA_ROOT, IMAGES_ENV, ML_ROOT, REPO_ROOT, DataPaths


def test_the_images_default_to_the_data_folder(tmp_path: Path):
    paths = DataPaths.under(tmp_path)
    assert paths.cells == tmp_path / "images" / "cells"
    assert paths.photos == tmp_path / "images" / "sudoku-photos"
    assert paths.cells_csv == tmp_path / "cells.csv"
    assert paths.journal == tmp_path / "work" / "journal.jsonl"


def test_the_environment_names_a_shared_image_store(tmp_path: Path, monkeypatch):
    monkeypatch.setenv(IMAGES_ENV, str(tmp_path / "store"))
    assert DataPaths.under(tmp_path / "data").cells == tmp_path / "store" / "cells"


def test_a_relative_image_store_starts_at_the_repository_root(tmp_path: Path, monkeypatch):
    monkeypatch.setenv(IMAGES_ENV, "shared")
    assert DataPaths.under(tmp_path).images == REPO_ROOT / "shared"


def test_an_explicit_images_root_wins(tmp_path: Path, monkeypatch):
    monkeypatch.setenv(IMAGES_ENV, str(tmp_path / "store"))
    assert DataPaths.under(tmp_path, tmp_path / "mine").images == tmp_path / "mine"


def test_the_dataset_folder_is_inside_ml():
    assert DATA_ROOT == ML_ROOT / "dataset"
    assert (REPO_ROOT / "AGENTS.md").exists()
