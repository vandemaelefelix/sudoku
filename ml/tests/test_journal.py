import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from sudoku_ml.journal import (
    FINISHED,
    Field,
    Line,
    Screen,
    append_records,
    current_kinds,
    current_sources,
    format_time,
    last_kind_times,
    parse_time,
    read_journal,
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
    assert read_journal(path) == lines * 2


def test_a_missing_log_is_empty(tmp_path: Path):
    assert read_journal(tmp_path / "none.jsonl") == []


def test_a_bad_line_names_its_line_number(tmp_path: Path):
    path = tmp_path / "log.jsonl"
    path.write_text('{"t": "x"}\n')
    with pytest.raises(ValueError, match=":1:"):
        read_journal(path)


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


def test_the_journal_applies_on_top_of_the_base():
    lines = [line(1, "s1", "s1-1", A, "kind", "printed", None)]
    assert current_kinds(lines, {A: "printed", B: "handwritten"}) == {A: None, B: "handwritten"}


def test_a_source_line_links_a_cell_to_its_photo():
    photo = "f" * 64
    lines = [line(1, "s1", "s1-1", A, "source", None, f"{photo} 2 8", "photos")]
    assert current_sources(lines, {B: (photo, 0, 0)}) == {A: (photo, 2, 8), B: (photo, 0, 0)}


def test_undo_skips_the_source_lines_of_a_cut():
    photo = "f" * 64
    lines = [
        line(1, "s1", "s1-1", A, "kind", None, "printed"),
        line(2, "s1", "s1-cut-1", B, "source", None, f"{photo} 0 0", "photos"),
    ]
    undo = undo_lines(lines, LATER, "s1")
    assert [(u.cell, u.field) for u in undo] == [(A, "kind")]


def test_rollback_skips_the_source_lines_of_a_cut():
    photo = "f" * 64
    lines = [
        line(1, "s1", "s1-cut-1", B, "source", None, f"{photo} 0 0", "photos"),
        line(2, "s1", "s1-1", B, "kind", None, "printed"),
    ]
    back = rollback_lines(lines, "s1", LATER, "s2")
    assert [(b.field, b.new) for b in back] == [("kind", None)]
    assert current_sources(lines + back) == {B: (photo, 0, 0)}


def test_rollback_of_a_finished_session_points_to_git():
    with pytest.raises(ValueError, match="This session is finished. Use git to go back."):
        rollback_lines([], "s1", LATER, "s2")
    assert FINISHED == "This session is finished. Use git to go back."


def test_a_line_with_enum_members_is_written_as_plain_strings(tmp_path: Path):
    path = tmp_path / "log.jsonl"
    append_records(path, [line(1, "s1", "s1-1", A, Field.DIGIT, "7", "1", Screen.DIGITS)])
    written = json.loads(path.read_text())
    assert (written["field"], written["screen"]) == ("digit", "digits")
    assert type(written["field"]) is str


def test_a_line_of_an_old_journal_equals_the_line_with_enum_members(tmp_path: Path):
    path = tmp_path / "log.jsonl"
    for screen in ("digits", "kinds", "groups", "scans", "review", "undo", "repair", "photos"):
        path.write_text(
            json.dumps(
                {
                    "t": LATER,
                    "session": "s",
                    "action": "s-1",
                    "cell": A,
                    "field": "kind",
                    "old": None,
                    "new": "printed",
                    "screen": screen,
                }
            )
            + "\n"
        )
        (read,) = read_journal(path)
        assert read.screen == Screen(screen) and read.field == Field.KIND
        assert current_kinds([read]) == {A: "printed"}
