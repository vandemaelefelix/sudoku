from sudoku_ml.sudoku_signals import add_reason, reasons_of, signal_entry

CELLS = [f"c{n}" for n in range(81)]


def labels(digits: dict[int, str], kind: str = "printed") -> list[tuple[str | None, str | None]]:
    return [(digits.get(n, "empty"), kind) for n in range(81)]


def test_a_reason_is_added_once_per_cell():
    found: dict[str, list[dict]] = {}
    add_reason(found, "a", {"signal": "not-unique"})
    add_reason(found, "a", {"signal": "not-unique"})
    add_reason(found, "a", {"signal": "rule-break", "unit": "row", "index": 0})
    assert found == {
        "a": [{"signal": "not-unique"}, {"signal": "rule-break", "unit": "row", "index": 0}]
    }


def test_a_row_with_a_digit_twice_gives_a_rule_break_to_both_places():
    entry: dict = {}
    assert signal_entry(entry, labels({0: "5", 3: "5"})) is True
    found: dict[str, list[dict]] = {}
    reasons_of(entry, CELLS, labels({0: "5", 3: "5"}), found)
    row = {"signal": "rule-break", "unit": "row", "index": 0}
    assert found["c0"] == [row] and found["c3"] == [row]
    assert not entry["not_unique"]


def test_the_same_labels_leave_the_entry_current():
    entry: dict = {}
    assert signal_entry(entry, labels({0: "5"})) is True
    assert signal_entry(entry, labels({0: "5"})) is False
    assert signal_entry(entry, labels({0: "6"})) is True


def test_a_scan_that_is_not_unique_marks_its_empty_places_only():
    entry = {"rule": [], "not_unique": True}
    found: dict[str, list[dict]] = {}
    reasons_of(entry, CELLS, labels({0: "5"}), found)
    assert "c0" not in found and len(found) == 80
    assert all(r == [{"signal": "not-unique"}] for r in found.values())


def test_a_place_without_a_cell_gets_no_reason():
    entry = {"rule": [[0, "row", 0]], "not_unique": True}
    found: dict[str, list[dict]] = {}
    places = [None] * 81
    reasons_of(entry, places, [(None, None)] * 81, found)
    assert found == {}
