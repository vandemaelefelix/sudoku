from datetime import UTC, datetime
from pathlib import Path

import pytest

from sudoku_ml.kind_log import (
    Line,
    append_records,
    current_kinds,
    format_time,
    last_kind_times,
    parse_time,
    read_log,
    rollback_lines,
    undo_lines,
)

A, B = "a" * 64, "b" * 64
LATER = "2026-10-12T10:00:00Z"


def line(second, session, action, cell, field, old, new, screen="groups") -> Line:
    return Line(f"2026-10-12T09:00:{second:02d}Z", session, action, cell, field, old, new, screen)


def test_append_then_read_round_trips(tmp_path: Path):
    path = tmp_path / "log.jsonl"
    lines = [line(1, "s1", "s1-1", A, "kind", None, "printed")]
    append_records(path, lines)
    append_records(path, lines)
    assert read_log(path) == lines * 2


def test_a_missing_log_is_empty(tmp_path: Path):
    assert read_log(tmp_path / "none.jsonl") == []


def test_a_bad_line_names_its_line_number(tmp_path: Path):
    path = tmp_path / "log.jsonl"
    path.write_text('{"t": "x"}\n')
    with pytest.raises(ValueError, match=":1:"):
        read_log(path)


def test_the_current_kind_is_the_last_kind_line():
    lines = [
        line(1, "s1", "s1-1", A, "kind", None, "printed"),
        line(2, "s1", "s1-2", A, "kind", "printed", "handwritten"),
        line(3, "s1", "s1-3", A, "digit", "7", "1"),
    ]
    assert current_kinds(lines) == {A: "handwritten"}
    assert last_kind_times(lines) == {A: "2026-10-12T09:00:02Z"}


def test_undo_reverses_the_whole_last_action():
    lines = [
        line(1, "s1", "s1-1", A, "kind", None, "printed"),
        line(2, "s1", "s1-2", A, "kind", "printed", "handwritten"),
        line(2, "s1", "s1-2", B, "kind", None, "printed"),
    ]
    undo = undo_lines(lines, LATER, "s1")
    assert [(u.cell, u.old, u.new, u.action, u.screen) for u in undo] == [
        (B, "printed", None, "undo:s1-2", "undo"),
        (A, "handwritten", "printed", "undo:s1-2", "undo"),
    ]
    assert current_kinds(lines + undo) == {A: "printed", B: None}


def test_a_second_undo_reverses_the_action_before():
    lines = [
        line(1, "s1", "s1-1", A, "kind", None, "printed"),
        line(2, "s1", "s1-2", A, "kind", "printed", "handwritten"),
    ]
    lines += undo_lines(lines, LATER, "s1")
    lines += undo_lines(lines, LATER, "s1")
    assert current_kinds(lines) == {A: None}
    assert undo_lines(lines, LATER, "s1") == []


def test_undo_never_reaches_into_another_session():
    lines = [line(1, "s1", "s1-1", A, "kind", None, "printed")]
    assert undo_lines(lines, LATER, "s2") == []


def test_rollback_reverses_every_action_of_a_session_newest_first():
    lines = [
        line(1, "s0", "s0-1", B, "kind", None, "printed"),
        line(2, "s1", "s1-1", A, "kind", None, "printed"),
        line(3, "s1", "s1-2", A, "digit", "7", "1"),
    ]
    back = rollback_lines(lines, "s1", LATER, "s2")
    assert [(b.field, b.new) for b in back] == [("digit", "7"), ("kind", None)]
    assert current_kinds(lines + back) == {A: None, B: "printed"}


def test_rollback_refuses_when_a_later_session_changed_the_cell():
    lines = [
        line(1, "s1", "s1-1", A, "kind", None, "printed"),
        line(2, "s2", "s2-1", A, "kind", "printed", "handwritten"),
    ]
    with pytest.raises(ValueError, match=A[:16]):
        rollback_lines(lines, "s1", LATER, "s3")


def test_a_second_rollback_of_the_same_session_does_nothing():
    lines = [line(1, "s1", "s1-1", A, "kind", None, "printed")]
    lines += rollback_lines(lines, "s1", LATER, "s2")
    assert rollback_lines(lines, "s1", LATER, "s3") == []


def test_times_round_trip():
    moment = datetime(2026, 10, 12, 9, 0, 1, tzinfo=UTC)
    assert parse_time(format_time(moment)) == moment
