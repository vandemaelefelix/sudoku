"""The Digits and Kind steps of the labelling app (ADR-034): the open cells of one tab ordered by
doubt, and the confirmation of cells (ADR-030). The two steps differ in a few functions only, so
one scoring function serves both."""

from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.doubt import (
    DIGIT_THRESHOLD,
    KIND_THRESHOLD,
    clamp_doubt,
    digit_doubt_raw,
    is_sure_digit,
    is_sure_kind,
    kind_doubt_raw,
)
from sudoku_ml.journal import KINDS, Field, Line, Screen, undone_actions
from sudoku_ml.label_lines import DIGIT_SCREENS, KIND_SCREENS, check_digit, check_kind
from sudoku_ml.label_state import LabelState
from sudoku_ml.open_cells import OpenCell, OpenCells, open_cells_of, open_digit_cells
from sudoku_ml.sudoku_signals import SudokuSignals
from sudoku_ml.tables import DIGIT_FOLDERS, stem_of

CHECK_SIZE = 240  # a full screen of 64 px cells
DIGIT_TABS = (*DIGIT_CLASSES, "unknown")


class ScoredCell(OpenCell):
    doubt: float  # at most 1
    raw: float  # the sum of the signals. It can pass 1 and sets the order
    reasons: list[dict]


@dataclass(frozen=True)
class Step:
    """What differs between the Digits step and the Kind step."""

    tabs: tuple[str, ...]
    field: Field  # the journal field that a confirmation writes
    screens: tuple[Screen, ...]  # the screens whose lines of that field a person made
    tab_of: Callable[[OpenCell], str]
    doubt: Callable[[OpenCell, list[dict]], tuple[float, list[dict]]]
    is_sure: Callable[[OpenCell, list[dict], float], bool]
    tab_hint: str  # follows the message for an unknown tab


# The last argument of `doubt` and `is_sure` is the sudoku reasons of the cell. Only the digit
# score uses it.
DIGITS = Step(
    DIGIT_TABS,
    Field.DIGIT,
    DIGIT_SCREENS,
    lambda c: c["digit"] or "unknown",
    lambda c, extra: digit_doubt_raw(c["digit"], c["probs"], c["edited"], extra),
    lambda c, extra, threshold: is_sure_digit(
        c["digit"], c["probs"], c["edited"], extra, threshold
    ),
    "",
)
KIND_STEP = Step(
    DIGIT_FOLDERS,
    Field.KIND,
    KIND_SCREENS,
    lambda c: c["digit"],
    lambda c, extra: kind_doubt_raw(c["kind"], c["probs"]),
    lambda c, extra, threshold: is_sure_kind(c["kind"], c["probs"], threshold),
    ": the Kind step has the digits 1 to 9",
)


def check_threshold(value: float) -> float:
    if not 0 < value <= 1:
        raise ValueError(f"the threshold {value} is not in 0 to 1")
    return value


def check_tab(step: Step, digit: str) -> None:
    if digit not in step.tabs:
        raise ValueError(f"unknown digit {digit!r}{step.tab_hint}")


def score_tab(
    step: Step,
    items: list[OpenCell],
    tab: str,
    threshold: float,
    extra: dict[str, list[dict]],
    keep: Callable[[OpenCell], bool] = lambda cell: True,
) -> tuple[Counter, list[ScoredCell], list[str]]:
    """Counts of the open cells per tab, the cells of `tab` that `keep` accepts with their doubt
    (the highest first), and the ids that `sure` would confirm. `extra` holds the sudoku reasons
    of each cell id."""
    counts = Counter(step.tab_of(c) for c in items)
    scored: list[ScoredCell] = []
    sure: list[str] = []
    for cell in items:
        if step.tab_of(cell) != tab or not keep(cell):
            continue
        reasons_of_cell = extra.get(cell["id"], [])
        raw, reasons = step.doubt(cell, reasons_of_cell)
        scored.append({**cell, "doubt": clamp_doubt(raw), "raw": raw, "reasons": reasons})
        if step.is_sure(cell, reasons_of_cell, threshold):
            sure.append(cell["id"])
    scored.sort(key=lambda c: (-c["raw"], c["id"]))
    return counts, scored, sure


def confirmed(lines: list[Line], step: Step) -> set[str]:
    """The cells that a person confirmed in this step, in this journal. An undone action does
    not count."""
    undone = undone_actions(lines)
    return {
        x.cell
        for x in lines
        if x.field == step.field and x.screen in step.screens and x.action not in undone
    }


def check_page(
    step: Step,
    digit: str,
    counts: Counter,
    scored: list[ScoredCell],
    sure: list[str],
    done: Counter,
    threshold: float,
) -> dict:
    return {
        "digit": digit,
        "cells": [{k: v for k, v in c.items() if k != "raw"} for c in scored[:CHECK_SIZE]],
        "left": len(scored),
        "counts": {t: counts[t] for t in step.tabs},
        "done": {t: done[t] for t in step.tabs},
        "sure": len(sure),
        "threshold": threshold,
    }


class CheckSteps:
    def __init__(self, state: LabelState, opens: OpenCells, signals: SudokuSignals):
        self._state, self._opens, self._signals = state, opens, signals

    def _done(self, step: Step) -> Counter:
        folder = self._state.folder
        return Counter(folder[c] for c in confirmed(self._state.lines, step) if c in folder)

    def _scored_digits(self, digit: str, threshold: float):
        check_tab(DIGITS, digit)
        threshold = check_threshold(threshold)
        work = self._opens.work()
        items = open_digit_cells(work)
        return score_tab(DIGITS, items, digit, threshold, self._signals.reasons(work))

    def _scored_kinds(self, digit: str, threshold: float, kind: str | None):
        """Like `_scored_digits` for the Kind step. The last value is the open count of `digit`
        per kind, with "all"."""
        check_tab(KIND_STEP, digit)
        if kind is not None and kind not in KINDS:
            raise ValueError(f"unknown kind {kind!r}: use one of {', '.join(KINDS)}")
        threshold = check_threshold(threshold)
        items = open_cells_of(self._opens.work())[1]
        here = [c for c in items if c["digit"] == digit]
        kind_counts = {"all": len(here), **{k: sum(c["kind"] == k for c in here) for k in KINDS}}
        counts, scored, sure = score_tab(
            KIND_STEP, items, digit, threshold, {}, lambda c: kind is None or c["kind"] == kind
        )
        return counts, scored, sure, kind_counts

    def check_digits(self, digit: str, threshold: float = DIGIT_THRESHOLD) -> dict:
        """The Digits step: the open digit cells of one tab, the highest doubt first."""
        counts, scored, sure = self._scored_digits(digit, threshold)
        done = self._done(DIGITS)
        return check_page(DIGITS, digit, counts, scored, sure, done, threshold)

    def check_kinds(
        self, digit: str, threshold: float = KIND_THRESHOLD, kind: str | None = None
    ) -> dict:
        """The Kind step: the open kind cells of one digit, the highest doubt first. `kind`
        shows one kind only. `left` and `sure` count the shown cells, `kind_counts` all of the
        digit."""
        counts, scored, sure, kind_counts = self._scored_kinds(digit, threshold, kind)
        page = check_page(KIND_STEP, digit, counts, scored, sure, self._done(KIND_STEP), threshold)
        return {**page, "kind_counts": kind_counts}

    def _confirm_digit_lines(self, entries: list[dict]) -> int:
        open_ids = {c["id"] for c in open_digit_cells(self._opens.work())}
        kinds, action = self._state.kinds(), self._state.action()
        lines, seen = [], set()
        for entry in entries:
            cell, digit = entry["id"], entry["digit"]
            if cell not in open_ids or cell in seen:
                raise ValueError(f"{stem_of(cell)}: not an open digit cell")
            check_digit(cell, digit)
            seen.add(cell)
            lines += action.digit_and_kind(
                cell,
                self._state.folder[cell],
                digit,
                kinds.get(cell),
                kinds.get(cell),
                Screen.DIGITS,
            )
        self._state.apply_digits(lines)
        self._state.write(lines)
        return len(lines)

    def confirm_digits(self, entries: list[dict]) -> int:
        """Confirm open digit cells as one action: a digit line per cell, also an unchanged one.
        A move to `empty` or `discarded` drops the kind. Checks all entries first. Finish writes
        `verified` for the cells."""
        self._state.refresh()
        return self._confirm_digit_lines(entries)

    def sure_digits(self, digit: str, threshold: float = DIGIT_THRESHOLD) -> int:
        """Confirm every sure cell of the tab as one action. Returns the number of cells."""
        self._state.refresh()
        _, scored, sure = self._scored_digits(digit, threshold)
        label = {c["id"]: c["digit"] for c in scored}
        self._confirm_digit_lines([{"id": c, "digit": label[c]} for c in sure])
        return len(sure)

    def _confirm_kind_lines(self, entries: list[dict]) -> int:
        open_ids = {c["id"] for c in open_cells_of(self._opens.work())[1]}
        kinds, action = self._state.kinds(), self._state.action()
        lines, seen = [], set()
        for entry in entries:
            cell, kind = entry["id"], entry["kind"]
            if cell not in open_ids or cell in seen:
                raise ValueError(f"{stem_of(cell)}: not an open kind cell")
            check_kind(cell, kind)
            seen.add(cell)
            lines.append(action.kind(cell, kinds.get(cell), kind, Screen.KINDS))
        self._state.write(lines)
        return len(lines)

    def confirm_kinds(self, entries: list[dict]) -> int:
        """Confirm open kind cells as one action: a kind line per cell, also an unchanged one.
        Checks all entries first."""
        self._state.refresh()
        return self._confirm_kind_lines(entries)

    def sure_kinds(
        self, digit: str, threshold: float = KIND_THRESHOLD, kind: str | None = None
    ) -> int:
        """Confirm every sure cell of the tab, of one kind if `kind` is set, as one action.
        Returns the number of cells."""
        self._state.refresh()
        _, scored, sure, _ = self._scored_kinds(digit, threshold, kind)
        label = {c["id"]: c["kind"] for c in scored}
        self._confirm_kind_lines([{"id": c, "kind": label[c]} for c in sure])
        return len(sure)
