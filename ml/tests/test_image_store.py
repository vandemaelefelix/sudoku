"""A missing or wrong image store must never wipe ml/dataset/cells.csv (ADR-018)."""

from pathlib import Path

import pytest
from cells import Clock, build, save_kinds, settle_kinds

from sudoku_ml import manifest
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.finish import finish
from sudoku_ml.label_server import main as server_main
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import repair_and_write, write_cells_manifest
from sudoku_ml.relabel import apply_relabels

HINT = "Check SUDOKU_IMAGES or restore the images. The table was not changed."


@pytest.fixture
def populated(tmp_path: Path) -> tuple[DataPaths, bytes]:
    paths, _ = build(tmp_path, {"7": 2, "unlabeled": 1})
    save_kinds(LabelStore(paths, Clock()), [])
    return paths, paths.cells_csv.read_bytes()


def wrong_store(paths: DataPaths, tmp_path: Path) -> DataPaths:
    return DataPaths.under(paths.root, tmp_path / "typo")


def one_cell_gone(paths: DataPaths) -> DataPaths:
    next((paths.cells / "7").glob("*.png")).unlink()
    return paths


def test_the_fold_refuses_a_missing_image_store(populated, tmp_path: Path):
    paths, table = populated
    wrong = wrong_store(paths, tmp_path)
    for fold in (write_cells_manifest, repair_and_write):
        with pytest.raises(ValueError, match=HINT):
            fold(wrong)
        assert paths.cells_csv.read_bytes() == table


def test_the_fold_refuses_a_store_that_lost_a_cell(populated):
    paths, table = populated
    one_cell_gone(paths)
    with pytest.raises(ValueError, match="1 of 3 rows .* --forget-missing"):
        write_cells_manifest(paths)
    with pytest.raises(ValueError, match=HINT):
        repair_and_write(paths)
    assert paths.cells_csv.read_bytes() == table


def test_the_flag_drops_the_rows_of_vanished_cells(populated, capsys):
    paths, _ = populated
    one_cell_gone(paths)
    assert manifest.main([], paths) == 1
    assert HINT in capsys.readouterr().err
    assert manifest.main(["--forget-missing"], paths) == 0
    assert len(paths.cells_csv.read_text().splitlines()) == 3


def test_the_store_finish_and_the_server_refuse_a_wrong_store(
    populated, tmp_path, capsys, make_store
):
    paths, table = populated
    wrong = wrong_store(paths, tmp_path)
    with pytest.raises(ValueError, match=HINT):
        make_store(wrong)
    store = make_store(paths)
    settle_kinds(store)
    one_cell_gone(paths)
    paths.journal.write_text("")
    with pytest.raises(ValueError, match=f"Finish stopped and deleted nothing.*{HINT}"):
        finish(store)
    assert server_main(["label_server"], wrong) == 1
    assert server_main(["label_server", "rollback", store.session], wrong) == 1
    assert HINT in capsys.readouterr().err
    assert paths.cells_csv.read_bytes() == table


def test_relabel_against_a_wrong_store_moves_nothing(populated, tmp_path: Path):
    paths, table = populated
    wrong = wrong_store(paths, tmp_path)
    relabels = tmp_path / "relabels.csv"
    relabels.write_text(f"file,new_label\n{next(iter(paths.cells.glob('7/*.png'))).stem},3\n")
    with pytest.raises(ValueError, match="no such cell"):
        apply_relabels(wrong.cells, relabels)
    assert manifest.main([], wrong) == 1
    assert paths.cells_csv.read_bytes() == table


def test_a_fresh_empty_dataset_starts(tmp_path: Path, make_store):
    paths = DataPaths.under(tmp_path / "data")
    paths.cells.mkdir(parents=True)
    assert write_cells_manifest(paths) == 0
    assert make_store(paths).folder == {}


def test_no_table_and_no_image_store_is_refused(tmp_path: Path):
    paths = DataPaths.under(tmp_path / "data")
    with pytest.raises(ValueError, match=HINT):
        write_cells_manifest(paths)
    assert not paths.cells_csv.exists()
