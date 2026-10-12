import os
from pathlib import Path

import pytest

from sudoku_ml.kind_check import CheckLine
from sudoku_ml.kind_log import Line, parse_time
from sudoku_ml.kind_review import check_items, model_items, near_duplicate_items, open_items

A, B, C = "a" * 64, "b" * 64, "c" * 64
HEADER = "field,file,label,predicted,p_label,p_predicted\n"


def kind(second: int, cell: str, new: str, screen: str = "groups", old=None) -> Line:
    t = f"2026-10-12T09:00:{second:02d}Z"
    return Line(t, "s", f"s-{second}", cell, "kind", old, new, screen)


def test_near_duplicates_with_different_kinds_both_go_to_review():
    lines = [kind(1, A, "printed"), kind(2, B, "handwritten"), kind(3, C, "printed")]
    items = near_duplicate_items([(A, B)], lines)
    assert sorted(i.cell for i in items) == [A, B]
    assert items[0].since == "2026-10-12T09:00:02Z"
    assert items[0].evidence["group"] == [A, B]


def test_only_a_direct_pair_counts_not_a_chain_of_pairs():
    lines = [kind(1, A, "printed"), kind(2, B, "printed"), kind(3, C, "handwritten")]
    items = near_duplicate_items([(A, B), (B, C)], lines)
    assert sorted(i.cell for i in items) == [B, C]


def test_unsure_does_not_count_as_a_disagreement():
    lines = [kind(1, A, "printed"), kind(2, B, "unsure")]
    assert near_duplicate_items([(A, B)], lines) == []


def test_a_review_line_after_the_evidence_closes_the_item():
    lines = [kind(1, A, "printed"), kind(2, B, "handwritten")]
    items = near_duplicate_items([(A, B)], lines)
    lines += [kind(5, A, "printed", "review", "printed")]
    assert [i.cell for i in open_items(items, lines)] == [B]


def test_a_review_line_before_the_evidence_does_not_close_the_item():
    lines = [kind(1, A, "printed", "review"), kind(2, A, "printed"), kind(3, B, "handwritten")]
    items = near_duplicate_items([(A, B)], lines)
    assert len(open_items(items, lines)) == 2


def write_suspects(path: Path, rows: list[str]) -> None:
    path.write_text(HEADER + "".join(r + "\n" for r in rows))
    moment = parse_time("2026-10-12T08:00:00Z").timestamp()
    os.utime(path, (moment, moment))


def test_model_items_come_from_the_suspects_file(tmp_path: Path):
    path = tmp_path / "suspects.csv"
    rows = [f"digit,{A[:16]},7,1,0.01,0.97", f"kind,{B[:16]},printed,handwritten,0.03,0.97"]
    write_suspects(path, rows)
    current = {(A, "digit"): "7", (B, "kind"): "printed"}
    items = model_items(path, {A[:16]: A, B[:16]: B}, lambda c, f: current.get((c, f)))
    assert [(i.cell, i.field, i.reason) for i in items] == [
        (A, "digit", "digit-model"),
        (B, "kind", "kind-model"),
    ]
    assert items[0].evidence == {
        "label": "7",
        "predicted": "1",
        "p_label": 0.01,
        "p_predicted": 0.97,
    }
    assert items[0].since == "2026-10-12T08:00:00Z"


def test_a_stale_or_unknown_suspect_is_dropped(tmp_path: Path):
    path = tmp_path / "suspects.csv"
    write_suspects(path, [f"digit,{A[:16]},7,1,0.01,0.97", f"digit,{'f' * 16},7,1,0.01,0.97"])
    assert model_items(path, {A[:16]: A}, lambda c, f: "1") == []


def test_no_suspects_file_means_no_items(tmp_path: Path):
    assert model_items(tmp_path / "none.csv", {}, lambda c, f: None) == []


def test_check_items_are_the_disagreements_that_still_hold():
    t = "2026-10-12T09:00:00Z"
    checks = [
        CheckLine(t, "c", A, "printed", "handwritten"),
        CheckLine(t, "c", B, "printed", "printed"),
        CheckLine(t, "c", C, "printed", "unsure"),
    ]
    current = {A: "printed", B: "printed", C: "handwritten"}
    items = check_items(checks, lambda c, f: current[c])
    assert [(i.cell, i.evidence) for i in items] == [
        (A, {"label": "printed", "answer": "handwritten"})
    ]


def test_an_old_suspects_file_asks_for_a_new_run(tmp_path: Path):
    path = tmp_path / "suspects.csv"
    path.write_text(f"file,label,predicted,p_label,p_predicted\n{A[:16]},7,1,0.01,0.97\n")
    with pytest.raises(ValueError, match="just suspects"):
        model_items(path, {A[:16]: A}, lambda c, f: "7")


def test_an_undone_review_confirmation_reopens_the_item(tmp_path: Path):
    path = tmp_path / "suspects.csv"
    write_suspects(path, [f"kind,{A[:16]},printed,handwritten,0.03,0.97"])
    lines = [kind(1, A, "printed")]
    confirm = Line("2026-10-12T09:30:00Z", "s", "s-9", A, "kind", "printed", "printed", "review")
    undo = Line("2026-10-12T09:31:00Z", "s", "undo:s-9", A, "kind", "printed", "printed", "undo")
    items = model_items(path, {A[:16]: A}, lambda c, f: "printed")
    assert open_items(items, [*lines, confirm]) == []
    assert len(open_items(items, [*lines, confirm, undo])) == 1
