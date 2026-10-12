"""The blind re-label: the developer labels old cells again. Agreement estimates label quality."""

from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np

from sudoku_ml.kind_log import Line, current_kinds, last_kind_times, parse_time

# Long enough that the developer no longer remembers the first answer.
MIN_AGE = timedelta(days=7)
_CHECKABLE = ("printed", "handwritten")


@dataclass(frozen=True)
class CheckLine:
    t: str
    session: str
    cell: str
    label: str  # the kind in the log when the check ran
    answer: str  # printed, handwritten or unsure


class NotEnoughCells(ValueError):
    def __init__(self, count: int, needed: int):
        super().__init__(f"only {count} cells qualify, the check needs {needed}")
        self.count = count


def draw_sample(
    lines: list[Line],
    checks: list[CheckLine],
    test_ids: set[str],
    now: datetime,
    n: int = 200,
    seed: int = 0,
    min_age: timedelta = MIN_AGE,
) -> list[str]:
    """n cell ids, half from the test split when it has enough. Raises NotEnoughCells."""
    kinds, times = current_kinds(lines), last_kind_times(lines)
    checked = {c.cell for c in checks}
    cutoff = now - min_age
    eligible = sorted(
        cell
        for cell, kind in kinds.items()
        if kind in _CHECKABLE and parse_time(times[cell]) <= cutoff and cell not in checked
    )
    if len(eligible) < n:
        raise NotEnoughCells(len(eligible), n)
    test = [c for c in eligible if c in test_ids]
    rest = [c for c in eligible if c not in test_ids]
    n_rest = min(n - min(n // 2, len(test)), len(rest))
    n_test = n - n_rest
    rng = np.random.default_rng(seed)
    picked = [str(c) for c in rng.choice(np.array(test, dtype=object), n_test, replace=False)]
    picked += [str(c) for c in rng.choice(np.array(rest, dtype=object), n_rest, replace=False)]
    return [picked[i] for i in rng.permutation(len(picked))]


def summary(checks: list[CheckLine]) -> dict | None:
    """Agreement and confusion of the newest check session. None before the first check."""
    if not checks:
        return None
    newest = [c for c in checks if c.session == checks[-1].session]
    confusion: dict[str, dict[str, int]] = {}
    for c in newest:
        row = confusion.setdefault(c.label, {})
        row[c.answer] = row.get(c.answer, 0) + 1
    agree = sum(c.label == c.answer for c in newest)
    return {
        "n": len(newest),
        "agreement": round(agree / len(newest), 4),
        "confusion": confusion,
        "date": newest[-1].t[:10],
    }
