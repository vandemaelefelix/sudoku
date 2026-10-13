"""Class lists and rules from docs/architecture/00-concepts/model-contract.md."""

CONTRACT_VERSION = "2.0"

DIGIT_CLASSES: tuple[str, ...] = ("empty", "1", "2", "3", "4", "5", "6", "7", "8", "9")
KIND_CLASSES: tuple[str, ...] = ("none", "printed", "handwritten", "notes")

_EMPTY_KINDS = frozenset({"none", "notes"})
_DIGIT_KINDS = frozenset({"printed", "handwritten"})


def is_valid_pair(digit: str, kind: str) -> bool:
    """Return True if the digit and kind can occur together in one cell."""
    if digit not in DIGIT_CLASSES or kind not in KIND_CLASSES:
        return False
    if digit == "empty":
        return kind in _EMPTY_KINDS
    return kind in _DIGIT_KINDS


CELL_SIZE = 64
"""Side of the cell image that the scanner's per-cell flatten produces."""

INPUT_SIZE = 32

CROP = (0, 64)
"""Rows and columns of the cell image that the model sees: all of them (ADR-020)."""

BATCH = 81
"""The static batch of the exported model: the 81 cells of one grid."""

UNKNOWN_KIND = -1
"""Kind target of a cell whose kind is not known. It adds no kind loss."""


def digit_index(label: str) -> int:
    return DIGIT_CLASSES.index(label)


def kind_index(kind: str) -> int:
    return KIND_CLASSES.index(kind)
