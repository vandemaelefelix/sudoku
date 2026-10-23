from collections import Counter

import pytest
from cells import probs

from sudoku_ml.check_steps import (
    CHECK_SIZE,
    DIGITS,
    KIND_STEP,
    check_page,
    check_tab,
    check_threshold,
    confirmed,
    score_tab,
)
from sudoku_ml.journal import Field, Line, Screen
from sudoku_ml.kind_review import ReviewItem
from sudoku_ml.review import merge_items


def cell(name: str, digit: str | None, kind: str | None, p: float = 0.99, **changes) -> dict:
    found = {
        "id": name,
        "stem": name,
        "photo": None,
        "source": "loose",
        "row": None,
        "col": None,
        "digit": digit,
        "kind": kind,
        "edited": False,
        "probs": probs(digit, p, kind) if digit and kind else None,
    }
    return {**found, **changes}


def line(cell_id: str, field: Field, screen: Screen, action: str = "a1") -> Line:
    return Line("2026-10-12T09:00:00Z", "s", action, cell_id, field, None, "x", screen)


def test_the_digits_step_orders_a_tab_by_the_highest_doubt_and_counts_every_tab():
    items = [cell("a", "7", "printed", 0.99), cell("b", "7", "printed", 0.5), cell("c", "3", None)]
    counts, scored, sure = score_tab(DIGITS, items, "7", 0.98, {})
    assert [c["id"] for c in scored] == ["b", "a"]
    assert counts == {"7": 2, "3": 1} and sure == ["a"]
    assert scored[0]["doubt"] <= 1 and scored[0]["raw"] >= scored[0]["doubt"]


def test_a_cell_without_a_digit_belongs_to_the_unknown_tab_and_is_never_sure():
    items = [cell("a", None, None), cell("b", "7", "printed")]
    counts, scored, sure = score_tab(DIGITS, items, "unknown", 0.98, {})
    assert counts == {"unknown": 1, "7": 1} and [c["id"] for c in scored] == ["a"] and sure == []
    assert scored[0]["reasons"] == [{"signal": "no-guess"}]


def test_a_rule_break_of_the_sudoku_signals_stops_a_cell_from_being_sure():
    items = [cell("a", "7", "printed"), cell("b", "7", "printed")]
    extra = {"a": [{"signal": "rule-break", "unit": "row", "index": 0}]}
    _, scored, sure = score_tab(DIGITS, items, "7", 0.98, extra)
    assert sure == ["b"]
    assert [c["id"] for c in scored] == ["a", "b"]


def test_the_kind_step_counts_per_digit_and_keeps_only_the_wanted_kind():
    items = [
        cell("a", "7", "printed"),
        cell("b", "7", "handwritten"),
        cell("c", "4", "printed"),
    ]
    counts, scored, sure = score_tab(
        KIND_STEP, items, "7", 0.95, {}, lambda c: c["kind"] == "handwritten"
    )
    assert counts == {"7": 2, "4": 1}
    assert [c["id"] for c in scored] == ["b"]
    assert sure == []


def test_equal_doubt_sorts_by_id():
    items = [cell("b", "7", "printed"), cell("a", "7", "printed")]
    _, scored, _ = score_tab(DIGITS, items, "7", 0.98, {})
    assert [c["id"] for c in scored] == ["a", "b"]


def test_the_tabs_and_the_threshold_are_checked():
    check_tab(DIGITS, "unknown")
    check_tab(KIND_STEP, "9")
    with pytest.raises(ValueError, match="unknown digit 'x'$"):
        check_tab(DIGITS, "x")
    with pytest.raises(ValueError, match="the Kind step has the digits 1 to 9"):
        check_tab(KIND_STEP, "empty")
    assert check_threshold(1) == 1
    for bad in (0, -0.1, 1.5):
        with pytest.raises(ValueError, match="threshold"):
            check_threshold(bad)


def test_a_step_counts_the_lines_of_its_field_and_screens_and_skips_undone_actions():
    lines = [
        line("a", Field.DIGIT, Screen.DIGITS),
        line("b", Field.DIGIT, Screen.OUTLINES),
        line("c", Field.KIND, Screen.KINDS),
        line("d", Field.DIGIT, Screen.SCANS, "a2"),
        line("d", Field.DIGIT, Screen.UNDO, "undo:a2"),
    ]
    assert confirmed(lines, DIGITS) == {"a"}
    assert confirmed(lines, KIND_STEP) == {"c"}


def test_a_page_lists_the_tabs_of_its_step_and_drops_the_raw_sum():
    items = [cell(str(n), "7", "printed") for n in range(CHECK_SIZE + 5)]
    counts, scored, sure = score_tab(DIGITS, items, "7", 0.98, {})
    page = check_page(DIGITS, "7", counts, scored, sure, Counter(), 0.98)
    assert len(page["cells"]) == CHECK_SIZE and page["left"] == CHECK_SIZE + 5
    assert "raw" not in page["cells"][0] and page["counts"]["7"] == CHECK_SIZE + 5
    assert list(page["done"]) == list(DIGITS.tabs)


def test_review_items_of_one_cell_merge_and_a_cell_without_a_folder_is_left_out():
    evidence = {"label": "printed"}
    items = [
        ReviewItem("a", Field.KIND, "kind-model", evidence, "t"),
        ReviewItem("a", Field.KIND, "check", {"answer": "unsure"}, "t"),
        ReviewItem("a", Field.DIGIT, "digit-model", {}, "t"),
        ReviewItem("gone", Field.KIND, "check", {}, "t"),
    ]
    merged = merge_items(items, {"a": "7"}, {"a": "printed"})
    assert [(m["field"], [r["reason"] for r in m["reasons"]]) for m in merged] == [
        ("kind", ["kind-model", "check"]),
        ("digit", ["digit-model"]),
    ]
    assert merged[0]["reasons"][0] == {"reason": "kind-model", "label": "printed"}
    assert (merged[0]["folder"], merged[0]["kind"], merged[0]["stem"]) == ("7", "printed", "a")
