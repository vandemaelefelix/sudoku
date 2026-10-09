"""Class lists and rules from docs/architecture/00-concepts/model-contract.md."""

CONTRACT_VERSION = "1.0"

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
