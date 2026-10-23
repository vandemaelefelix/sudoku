import pytest

from sudoku_ml.journal import Field, Line, Screen
from sudoku_ml.label_lines import Action, check_digit, check_kind, kind_for

CELL = "ab" * 32
ACTION = Action("2026-10-12T09:00:00Z", "s1", "s1-3")


def test_an_action_gives_each_line_its_time_session_and_id():
    line = ACTION.kind(CELL, None, "printed", Screen.KINDS)
    assert line == Line(
        "2026-10-12T09:00:00Z", "s1", "s1-3", CELL, "kind", None, "printed", "kinds"
    )


def test_a_source_line_formats_the_source_and_a_label_source_line_keeps_the_text():
    source = ACTION.source(CELL, ("p" * 64, 2, 5), Screen.OUTLINES)
    assert (source.field, source.old, source.new) == (Field.SOURCE, None, f"{'p' * 64} 2 5")
    provenance = ACTION.label_source(CELL, "app-edited", Screen.OUTLINES)
    assert (provenance.field, provenance.new) == (Field.LABEL_SOURCE, "app-edited")


def test_an_outline_line_belongs_to_the_outlines_screen():
    line = ACTION.outline("p" * 64, "unchecked", "accepted 1.0 2.0")
    assert (line.cell, line.field, line.screen) == ("p" * 64, Field.OUTLINE, Screen.OUTLINES)


@pytest.mark.parametrize(
    ("digit", "kind", "expected"),
    [("7", "printed", "printed"), ("empty", "printed", None), ("discarded", "unsure", None)]
    + [("unlabeled", "printed", None), ("1", None, None)],
)
def test_only_a_cell_in_a_digit_folder_keeps_its_kind(digit, kind, expected):
    assert kind_for(digit, kind) == expected


@pytest.mark.parametrize(
    ("digit", "old_kind", "kind", "same", "expected"),
    [
        ("7", "printed", "printed", False, ["digit"]),
        ("7", "printed", "printed", True, ["digit", "kind"]),
        ("7", None, "printed", False, ["digit", "kind"]),
        ("7", "printed", "handwritten", False, ["digit", "kind"]),
        ("empty", "printed", "printed", False, ["digit", "kind"]),
        ("empty", None, None, True, ["digit"]),
        ("discarded", None, "printed", False, ["digit"]),
    ],
)
def test_the_kind_line_follows_the_kind_rule(digit, old_kind, kind, same, expected):
    lines = ACTION.digit_and_kind(CELL, "7", digit, old_kind, kind, Screen.DIGITS, same)
    assert [x.field for x in lines] == expected
    assert lines[0].old == "7" and lines[0].new == digit
    if len(lines) == 2:
        assert (lines[1].old, lines[1].new) == (old_kind, kind_for(digit, kind))


def test_a_digit_that_a_person_cannot_give_is_refused_with_the_cell_stem():
    check_digit(CELL, "discarded")
    with pytest.raises(ValueError, match=f"^{CELL[:16]}: unknown digit 'unlabeled'"):
        check_digit(CELL, "unlabeled")


def test_check_kind_has_two_messages():
    check_kind(CELL, "unsure")
    with pytest.raises(ValueError, match="unknown kind 'typed'"):
        check_kind(CELL, "typed")
    with pytest.raises(ValueError, match="the digit 7 needs a kind"):
        check_kind(CELL, None, "7")
