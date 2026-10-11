from datetime import timedelta

import pytest

from sudoku_ml.kind_check import CheckLine, NotEnoughCells, draw_sample, summary
from sudoku_ml.kind_log import Line, parse_time

OLD, NEW = "2026-10-01T09:00:00Z", "2026-10-10T09:00:00Z"
NOW = parse_time("2026-10-11T09:00:00Z")


def ids(n: int, start: int = 0) -> list[str]:
    return [f"{i:064x}" for i in range(start, start + n)]


def labelled(cells: list[str], t: str = OLD, kind: str = "printed") -> list[Line]:
    return [Line(t, "s", f"s-{i}", c, "kind", None, kind, "groups") for i, c in enumerate(cells)]


def test_only_labels_seven_days_old_or_older_qualify():
    old, new = ids(10), ids(10, start=100)
    sample = draw_sample(labelled(old) + labelled(new, NEW), [], set(), NOW, n=10)
    assert sorted(sample) == old


def test_unsure_and_unlabelled_cells_never_qualify():
    cells = ids(4)
    lines = labelled(cells[:2]) + labelled(cells[2:3], kind="unsure")
    with pytest.raises(NotEnoughCells) as error:
        draw_sample(lines, [], set(), NOW, n=3)
    assert error.value.count == 2


def test_half_of_the_sample_comes_from_the_test_split():
    test, other = ids(50), ids(50, start=100)
    sample = draw_sample(labelled(test + other), [], set(test), NOW, n=20)
    assert len(set(sample) & set(test)) == 10


def test_a_small_test_split_is_filled_from_the_other_cells():
    test, other = ids(3), ids(50, start=100)
    sample = draw_sample(labelled(test + other), [], set(test), NOW, n=20)
    assert len(sample) == 20 and set(test) <= set(sample)


def test_checked_cells_are_not_drawn_again():
    cells = ids(12)
    checks = [CheckLine(OLD, "c", c, "printed", "printed") for c in cells[:2]]
    sample = draw_sample(labelled(cells), checks, set(), NOW, n=10)
    assert not set(sample) & set(cells[:2])


def test_the_draw_is_deterministic():
    lines = labelled(ids(40))
    assert draw_sample(lines, [], set(), NOW, n=10) == draw_sample(lines, [], set(), NOW, n=10)


def test_min_age_is_configurable():
    lines = labelled(ids(5), NEW)
    assert len(draw_sample(lines, [], set(), NOW, n=5, min_age=timedelta(hours=1))) == 5


def test_summary_covers_the_newest_session_only():
    checks = [
        CheckLine(OLD, "c1", "x", "printed", "handwritten"),
        CheckLine(NEW, "c2", "a", "printed", "printed"),
        CheckLine(NEW, "c2", "b", "printed", "handwritten"),
        CheckLine(NEW, "c2", "c", "handwritten", "handwritten"),
        CheckLine(NEW, "c2", "d", "handwritten", "handwritten"),
    ]
    assert summary(checks) == {
        "n": 4,
        "agreement": 0.75,
        "confusion": {
            "printed": {"printed": 1, "handwritten": 1},
            "handwritten": {"handwritten": 2},
        },
        "date": "2026-10-10",
    }
    assert summary([]) is None
