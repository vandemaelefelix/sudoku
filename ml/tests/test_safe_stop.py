"""A person can stop at any moment and keep every label (ADR-009)."""

from pathlib import Path

from cells import Clock, add_cell, build, move_digit, pattern, save_kinds

from sudoku_ml.label_server import main
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.relabel import move_cells


def reopened(paths) -> LabelStore:
    return LabelStore(paths, Clock())


def test_every_save_is_in_the_files_when_its_call_returns(tmp_path: Path, make_store):
    paths, ids = build(tmp_path, {"7": 2, "unlabeled": 3})
    store = make_store(paths)
    waiting = ids["unlabeled"]

    store.confirm_digits(
        [{"id": waiting[0], "digit": "2"}, {"id": waiting[1], "digit": "discarded"}]
    )
    again = reopened(paths)
    assert (again.folder[waiting[0]], again.folder[waiting[1]]) == ("2", "discarded")
    assert again.folder[waiting[2]] == "unlabeled"

    save_kinds(store, [{"id": ids["7"][0], "kind": "printed"}])
    assert reopened(paths).kinds()[ids["7"][0]] == "printed"

    move_digit(store, ids["7"][1], "3", "groups")
    assert reopened(paths).folder[ids["7"][1]] == "3"

    store.undo()
    assert reopened(paths).folder[ids["7"][1]] == "7"
    unlabeled = [c for c, f in reopened(paths).folder.items() if f == "unlabeled"]
    assert unlabeled == [waiting[2]]


def test_a_stop_between_the_file_move_and_the_log_line_is_repaired(tmp_path: Path, make_store):
    paths, ids = build(tmp_path, {"7": 1})
    cell = ids["7"][0]
    save_kinds(make_store(paths), [{"id": cell, "kind": "handwritten"}])
    # The process dies after the move and before the log line.
    move_cells(paths.cells, {cell[:16]: "empty"})
    store = reopened(paths)
    assert store.folder[cell] == "empty"
    assert store.repair() == 1
    assert store.kinds()[cell] is None
    assert write_cells_manifest(paths) == 1
    assert reopened(paths).repair() == 0


def test_cells_that_the_manifest_does_not_list_are_read_after_a_stop(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1})
    stray = add_cell(paths.cells, "unlabeled", pattern(777))
    store = reopened(paths)
    assert store.folder[stray] == "unlabeled"
    assert write_cells_manifest(paths) == 2


def test_a_leftover_temporary_file_does_not_break_the_store_or_the_manifest(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1})
    tmp = paths.work / "tmp"
    tmp.mkdir()
    (tmp / "half.png").write_bytes(b"not a png")
    assert reopened(paths).folder
    assert write_cells_manifest(paths) == 1


def test_the_start_cleans_leftovers_and_prints_what_waits(tmp_path: Path, monkeypatch, capsys):
    paths, _ = build(tmp_path, {"7": 1, "unlabeled": 2})
    tmp = paths.work / "tmp"
    tmp.mkdir()
    (tmp / "half.png").write_bytes(b"x")
    (paths.cells / "unlabeled" / "tmp-cut.png").write_bytes(b"x")

    class Stop:
        server_port = 0

        def serve_forever(self):
            raise KeyboardInterrupt

        def server_close(self):
            pass

    monkeypatch.setattr("sudoku_ml.label_server.make_server", lambda store, **_: Stop())
    monkeypatch.setattr("sudoku_ml.label_server.webbrowser.open", lambda url: None)
    assert main(["label_server"], paths) == 0
    assert list(tmp.glob("*")) == [] and not (paths.cells / "unlabeled" / "tmp-cut.png").exists()
