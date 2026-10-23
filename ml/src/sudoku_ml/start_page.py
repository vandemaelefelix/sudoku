"""The counts that the start page and the training run read: what waits, and what the labels
hold. Neither reads a cell image or runs a model."""

from collections import Counter

from sudoku_ml.kind_check import summary
from sudoku_ml.label_state import LabelState
from sudoku_ml.open_cells import OpenCells, open_cells_of
from sudoku_ml.review import Review
from sudoku_ml.tables import DIGIT_FOLDERS


def start_status(state: LabelState, opens: OpenCells, review: Review) -> dict:
    """The counts of the start page."""
    state.refresh()
    work = opens.work()
    digits, kinds = open_cells_of(work)
    return {
        "outlines": sum(s.status == "unchecked" for s in work.states),
        "digit_cells": len(digits),
        "kind_cells": len(kinds),
        "not_prelabelled": sum(c["probs"] is None for c in digits + kinds),
        "model": work.model,
        "doubtful": review.open_count(),
        "suspects": state.paths.suspects.exists(),
        "changes": len(state.lines),
    }


def label_summary(state: LabelState, review: Review) -> dict:
    """The kinds of the cells in the digit folders, the open Review items and the blind check."""
    state.refresh()
    counts = Counter(state.kinds().get(c) for c, f in state.folder.items() if f in DIGIT_FOLDERS)
    return {
        "printed": counts["printed"],
        "handwritten": counts["handwritten"],
        "unsure": counts["unsure"],
        "review_open": len(review.items()),
        "check": summary(state.checks),
    }
