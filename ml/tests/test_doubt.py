import pytest
from cells import probs

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.doubt import (
    clamp_doubt,
    count_solutions,
    digit_doubt_raw,
    is_sure_digit,
    is_sure_kind,
    kind_doubt_raw,
    labels_key,
    rule_breaks,
    scan_signals,
)

# A known puzzle with exactly one solution, row by row.
PUZZLE = "".join(
    ["530070000", "600195000", "098000060", "800060003", "400803001", "700020006"]
    + ["060000280", "000419005", "000080079"]
)


def grid(text: str) -> list[int]:
    return [int(c) for c in text]


def test_a_digit_twice_in_a_row_a_column_or_a_box_is_a_rule_break():
    places = [0] * 81
    places[0] = places[4] = 5  # the same row
    places[10] = places[64] = 7  # column 1
    places[30] = places[50] = 2  # (3, 3) and (5, 5): box 4 only
    found = rule_breaks(places)
    assert found[0] == found[4] == [("row", 0)]
    assert found[10] == found[64] == [("col", 1)]
    assert found[30] == found[50] == [("box", 4)]
    places = [0] * 81
    places[0] = places[10] = 4  # one box, no row, no column
    assert rule_breaks(places) == {0: [("box", 0)], 10: [("box", 0)]}


def test_a_clean_grid_has_no_rule_break():
    assert rule_breaks(grid(PUZZLE)) == {}


def test_the_box_index_runs_over_the_boxes_row_by_row():
    places = [0] * 81
    places[3] = places[23] = 9  # (0, 3) and (2, 5): box 1
    places[60] = places[80] = 3  # (6, 6) and (8, 8): box 8
    assert rule_breaks(places) == {
        3: [("box", 1)],
        23: [("box", 1)],
        60: [("box", 8)],
        80: [("box", 8)],
    }


def test_the_counter_finds_one_solution_for_a_proper_puzzle():
    assert count_solutions(grid(PUZZLE)) == 1


def test_the_counter_stops_at_two_for_an_open_grid():
    assert count_solutions([0] * 81) == 2
    assert count_solutions([0] * 81, limit=3) == 3


def test_a_grid_with_a_rule_break_or_a_dead_place_has_no_solution():
    clash = [0] * 81
    clash[0] = clash[1] = 5
    assert count_solutions(clash) == 0
    dead = [0] * 81
    dead[0:8] = [1, 2, 3, 4, 5, 6, 7, 8]
    dead[15] = 9  # place 8 sees 1-8 in its row and 9 in its box: no digit is left
    assert count_solutions(dead) == 0


def test_the_counter_gives_up_on_a_search_that_is_too_long():
    assert count_solutions([0] * 81, limit=10**9, max_steps=50) is None


def test_a_puzzle_with_a_missing_given_is_not_unique():
    puzzle = grid(PUZZLE)
    puzzle[0] = 0  # drop a given: the puzzle still has one solution
    assert scan_signals(puzzle, puzzle)["not_unique"] is False
    for place, digit in enumerate(puzzle):
        if digit:
            puzzle[place] = 0
    puzzle[1] = 3
    assert scan_signals(puzzle, puzzle)["not_unique"] is True


def test_a_scan_without_a_given_says_nothing_about_uniqueness():
    assert scan_signals([0] * 81, [0] * 81)["not_unique"] is False


def test_the_labels_key_changes_with_a_digit_or_a_kind():
    base = [(0, False)] * 81
    assert labels_key(base) == labels_key(list(base))
    assert (
        len(
            {
                labels_key(base),
                labels_key([(1, False), *base[1:]]),
                labels_key([(0, True), *base[1:]]),
            }
        )
        == 3
    )


def test_a_sure_cell_has_a_doubt_of_one_minus_its_probability():
    doubt, reasons = digit_doubt_raw("7", probs("7", 0.99), False, [])
    assert doubt == pytest.approx(0.01) and reasons == []


def test_low_p_names_its_probability():
    doubt, reasons = digit_doubt_raw("7", probs("7", 0.6), False, [])
    assert doubt == pytest.approx(0.4)
    assert reasons == [{"signal": "low-p", "p": 0.6}]


def test_a_model_that_reads_another_digit_adds_a_half_and_names_it():
    doubt, reasons = digit_doubt_raw("1", probs("7", 0.9), False, [])
    assert doubt == pytest.approx(1 - 0.1 / 9 + 0.5)
    assert reasons[0] == {"signal": "model-differs", "predicted": "7", "p": 0.9}
    other, _ = digit_doubt_raw("1", probs("7", 0.3), False, [])
    assert other == pytest.approx(1 - 0.7 / 9 + 0.5)


def test_a_player_change_a_rule_break_and_a_non_unique_grid_nudge_the_order():
    rule = {"signal": "rule-break", "unit": "row", "index": 3}
    unique = {"signal": "not-unique"}
    plain, _ = digit_doubt_raw("7", probs("7", 0.95), False, [])
    edited, reasons = digit_doubt_raw("7", probs("7", 0.95), True, [])
    broken, _ = digit_doubt_raw("7", probs("7", 0.95), False, [rule])
    loose, _ = digit_doubt_raw("7", probs("7", 0.95), False, [unique])
    assert (edited - plain, broken - plain, loose - plain) == pytest.approx((0.3, 0.2, 0.1))
    assert {"signal": "edited"} in reasons
    _, with_both = digit_doubt_raw("7", probs("7", 0.95), False, [rule, unique])
    assert with_both == [rule, unique]


def test_the_doubt_never_passes_one_but_the_raw_sum_does():
    rule = {"signal": "rule-break", "unit": "box", "index": 0}
    raw, _ = digit_doubt_raw("1", probs("7", 0.9), True, [rule])
    assert raw > 1 and clamp_doubt(raw) == 1


def test_cells_that_the_model_reads_differently_keep_their_order_above_one():
    raws = []
    for p in (0.4, 0.2, 0.01):
        digit = [0.0] * 10
        digit[DIGIT_CLASSES.index("1")] = p
        digit[DIGIT_CLASSES.index("7")] = 1 - p
        raws.append(digit_doubt_raw("1", {"digit": digit, "kind": [0, 1, 0, 0]}, False, [])[0])
    assert all(raw > 1 for raw in raws)
    assert {clamp_doubt(raw) for raw in raws} == {1}
    assert raws == sorted(raws)


def test_a_cell_without_probabilities_has_a_doubt_of_one_and_keeps_its_other_signals():
    doubt, reasons = digit_doubt_raw("7", None, True, [])
    assert doubt == 1 and reasons == [{"signal": "no-guess"}, {"signal": "edited"}]
    assert digit_doubt_raw(None, None, False, []) == (1.0, [{"signal": "no-guess"}])


def test_the_kind_doubt_renormalises_over_printed_and_handwritten():
    kind = {"digit": [0.0] * 10, "kind": [0.4, 0.5, 0.05, 0.05]}
    doubt, reasons = kind_doubt_raw("printed", kind)
    assert doubt == pytest.approx(1 - 0.5 / 0.55, abs=1e-4) and reasons == []
    assert clamp_doubt(kind_doubt_raw("handwritten", kind)[0]) == 1


def test_a_model_that_reads_the_other_kind_adds_a_half():
    doubt, reasons = kind_doubt_raw("printed", probs("7", 0.9, "handwritten", 0.8))
    assert doubt == pytest.approx(0.8 + 0.5)
    assert reasons[0] == {"signal": "model-differs", "predicted": "handwritten", "p": 0.8}
    assert kind_doubt_raw("unsure", probs("7", 0.9))[0] == 1
    assert kind_doubt_raw("printed", None) == (1.0, [{"signal": "no-guess"}])


@pytest.mark.parametrize(
    ("p", "edited", "rule", "threshold", "expected"),
    [
        (0.99, False, False, 0.98, True),
        (0.97, False, False, 0.98, False),
        (0.97, False, False, 0.96, True),
        (0.99, True, False, 0.98, False),
        (0.99, False, True, 0.98, False),
    ],
)
def test_a_digit_is_sure_without_a_change_and_a_rule_break(p, edited, rule, threshold, expected):
    sudoku = [{"signal": "rule-break", "unit": "row", "index": 0}] if rule else []
    assert is_sure_digit("7", probs("7", p), edited, sudoku, threshold) is expected


def test_the_model_must_read_the_label_for_a_sure_digit():
    assert not is_sure_digit("1", probs("7", 0.99), False, [], 0.5)
    assert not is_sure_digit("7", None, False, [], 0.5)
    not_unique = [{"signal": "not-unique"}]
    assert is_sure_digit("7", probs("7", 0.99), False, not_unique, 0.98)


def test_a_kind_is_sure_when_the_model_reads_it_with_the_threshold():
    assert is_sure_kind("printed", probs("7", 0.9, "printed", 0.96), 0.95)
    assert not is_sure_kind("printed", probs("7", 0.9, "printed", 0.94), 0.95)
    assert not is_sure_kind("printed", probs("7", 0.9, "handwritten", 0.99), 0.95)
    assert not is_sure_kind("unsure", probs("7", 0.9, "printed", 0.99), 0.95)
    assert not is_sure_kind("printed", None, 0.95)
