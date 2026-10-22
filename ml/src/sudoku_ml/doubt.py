"""The doubt score of the Digits and Kind steps of the labelling app (ADR-030, amendment
2026-10-22). The score only sets the order: a person still checks every cell. It adds the signals
of one cell. Each signal keeps its evidence, so the app can name it. The sudoku signals need no
model. SUD-07 forbids an import of the TypeScript core, so the solution counter lives here."""

import hashlib
import json

from sudoku_ml.contract import DIGIT_CLASSES

GRID = 9
BOX = 3
PLACES = GRID * GRID
LOW_P = 0.9  # below this probability of its label, a cell shows the signal `low-p`
DIGIT_THRESHOLD = 0.98
KIND_THRESHOLD = 0.95
# A grid with few givens and a deep contradiction can make the search exponential. The count
# then gives up, and the scan gets no `not-unique` signal.
MAX_STEPS = 200_000
LABELLED_KINDS = ("printed", "handwritten")
PRINTED, HANDWRITTEN = 1, 2  # indices in KIND_CLASSES: none, printed, handwritten, notes

# Weights of the formulas in the contract of the Digits and Kind steps.
W_DIFFERS, W_EDITED, W_RULE, W_UNIQUE = 0.5, 0.3, 0.2, 0.1
KIND_W_DIFFERS = 0.5

Probs = dict[str, list[float]]  # {"digit": 10 floats, "kind": 4 floats}


def _units() -> list[tuple[str, int, list[int]]]:
    rows = [("row", r, [r * GRID + c for c in range(GRID)]) for r in range(GRID)]
    cols = [("col", c, [r * GRID + c for r in range(GRID)]) for c in range(GRID)]
    boxes = [
        (
            "box",
            br * BOX + bc // BOX,
            [(br * BOX + r) * GRID + bc + c for r in range(BOX) for c in range(BOX)],
        )
        for br in range(BOX)
        for bc in range(0, GRID, BOX)
    ]
    return rows + cols + boxes


UNITS = _units()
PEERS = [sorted({p for _, _, u in UNITS if i in u for p in u} - {i}) for i in range(PLACES)]


def rule_breaks(grid: list[int]) -> dict[int, list[tuple[str, int]]]:
    """Place (0-80) → the units (`row`, `col` or `box`, index 0-8) in which its digit (1-9) is
    twice. 0 is an empty place."""
    found: dict[int, list[tuple[str, int]]] = {}
    for unit, index, places in UNITS:
        seen: dict[int, list[int]] = {}
        for place in places:
            if grid[place]:
                seen.setdefault(grid[place], []).append(place)
        for twins in seen.values():
            if len(twins) > 1:
                for place in twins:
                    found.setdefault(place, []).append((unit, index))
    return found


class _TooHard(Exception):
    pass


def count_solutions(grid: list[int], limit: int = 2, max_steps: int = MAX_STEPS) -> int | None:
    """The number of solutions of a grid (81 digits, 0 is empty), counted up to `limit`. A grid
    with a rule break has none. Returns None when the search needs more than `max_steps` steps.
    Backtracking on the place with the fewest options."""
    if rule_breaks(grid):
        return 0
    cells = list(grid)
    full = (1 << (GRID + 1)) - 2  # bits 1-9
    steps = 0

    def options(place: int) -> int:
        used = 0
        for peer in PEERS[place]:
            used |= 1 << cells[peer]
        return full & ~used

    def solve() -> int:
        nonlocal steps
        steps += 1
        if steps > max_steps:
            raise _TooHard
        best, best_options = -1, 0
        for place in range(PLACES):
            if cells[place]:
                continue
            found = options(place)
            if found == 0:
                return 0
            if best < 0 or found.bit_count() < best_options.bit_count():
                best, best_options = place, found
                if found.bit_count() == 1:
                    break
        if best < 0:
            return 1
        total = 0
        for digit in range(1, GRID + 1):
            if best_options >> digit & 1:
                cells[best] = digit
                total += solve()
                cells[best] = 0
                if total >= limit:
                    break
        return total

    try:
        return min(solve(), limit)
    except _TooHard:
        return None


def scan_signals(digits: list[int], givens: list[int]) -> dict:
    """The sudoku signals of one scan, from 81 digits (all labelled digits) and 81 givens (the
    printed digits). 0 is an empty place.

    `rule`: place → [(unit, index)]. `not_unique`: the givens have more than one solution. It
    stays False without any given: then nothing is known about the grid."""
    not_unique = False
    if any(givens):
        not_unique = (count_solutions(givens) or 0) > 1
    return {"rule": rule_breaks(digits), "not_unique": not_unique}


def labels_key(labels: list[tuple[int, bool]]) -> str:
    """The cache key of the labels of one scan: (digit, printed) per place."""
    return hashlib.sha1(json.dumps(labels).encode()).hexdigest()[:16]


def _round(value: float) -> float:
    return round(float(value), 4)


def kind_probs(probs: Probs) -> tuple[float, float]:
    """The probabilities of printed and handwritten, renormalised to sum to 1."""
    printed, handwritten = probs["kind"][PRINTED], probs["kind"][HANDWRITTEN]
    total = printed + handwritten
    if total <= 0:
        return 0.5, 0.5
    return printed / total, handwritten / total


def model_kind(probs: Probs) -> tuple[str, float]:
    """The kind that the model reads (printed or handwritten) and its renormalised probability."""
    printed, handwritten = kind_probs(probs)
    return ("printed", printed) if printed >= handwritten else ("handwritten", handwritten)


def clamp_doubt(raw: float) -> float:
    """The doubt of the API and the tile colour: the raw sum, at most 1."""
    return _round(min(1.0, raw))


def digit_doubt_raw(
    label: str | None, probs: Probs | None, edited: bool, sudoku: list[dict]
) -> tuple[float, list[dict]]:
    """The sum of the signals of a digit label, and its reasons. The sum can pass 1. It sets the
    order of the cells, because a clamp would tie every cell that the model reads differently.
    `sudoku` holds the `rule-break` and `not-unique` reasons of the cell. Without probabilities
    the sum is 1."""
    reasons: list[dict] = []
    rule = any(r["signal"] == "rule-break" for r in sudoku)
    unique = any(r["signal"] == "not-unique" for r in sudoku)
    doubt = 1.0
    if probs is None or label is None:
        reasons.append({"signal": "no-guess"})
    else:
        digit = probs["digit"]
        p_label = digit[DIGIT_CLASSES.index(label)]
        top = max(range(len(digit)), key=digit.__getitem__)
        differs = DIGIT_CLASSES[top] != label
        if differs:
            read = {"signal": "model-differs", "predicted": DIGIT_CLASSES[top]}
            reasons.append({**read, "p": _round(digit[top])})
        if p_label < LOW_P:
            reasons.append({"signal": "low-p", "p": _round(p_label)})
        doubt = 1 - p_label + W_DIFFERS * differs + W_EDITED * edited
        doubt += W_RULE * rule + W_UNIQUE * unique
    if edited:
        reasons.append({"signal": "edited"})
    reasons += sudoku
    return doubt, reasons


def kind_doubt_raw(kind: str | None, probs: Probs | None) -> tuple[float, list[dict]]:
    """The sum of the signals of a kind label, from the model's kind head alone, and its reasons.
    Like the digit sum it can pass 1. A label that is not printed or handwritten (`unsure`)
    counts as a probability of 0."""
    if probs is None or kind is None:
        return 1.0, [{"signal": "no-guess"}]
    printed, handwritten = kind_probs(probs)
    reasons: list[dict] = []
    p_label = {"printed": printed, "handwritten": handwritten}.get(kind, 0.0)
    read, p_read = model_kind(probs)
    differs = kind in LABELLED_KINDS and read != kind
    if differs:
        reasons.append({"signal": "model-differs", "predicted": read, "p": _round(p_read)})
    if p_label < LOW_P:
        reasons.append({"signal": "low-p", "p": _round(p_label)})
    return (1 - p_label) + KIND_W_DIFFERS * differs, reasons


def is_sure_digit(
    label: str | None, probs: Probs | None, edited: bool, sudoku: list[dict], threshold: float
) -> bool:
    """The model's top digit is the label with at least `threshold`, and the player did not
    change it, and it breaks no rule. A cell without probabilities is never sure."""
    if probs is None or label is None or edited:
        return False
    if any(r["signal"] == "rule-break" for r in sudoku):
        return False
    digit = probs["digit"]
    top = max(range(len(digit)), key=digit.__getitem__)
    return DIGIT_CLASSES[top] == label and digit[top] >= threshold


def is_sure_kind(kind: str | None, probs: Probs | None, threshold: float) -> bool:
    """The model's top kind (printed or handwritten) is the label with at least `threshold`."""
    if probs is None or kind not in LABELLED_KINDS:
        return False
    read, p_read = model_kind(probs)
    return read == kind and p_read >= threshold
