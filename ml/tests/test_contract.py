from sudoku_ml.contract import (
    BATCH,
    CELL_SIZE,
    CONTRACT_VERSION,
    CROP,
    DIGIT_CLASSES,
    INPUT_SIZE,
    KIND_CLASSES,
    UNKNOWN_KIND,
    digit_index,
    is_valid_pair,
    kind_index,
)


def test_contract_version():
    assert CONTRACT_VERSION == "1.0"


def test_digit_classes_in_contract_order():
    assert DIGIT_CLASSES == ("empty", "1", "2", "3", "4", "5", "6", "7", "8", "9")


def test_kind_classes_in_contract_order():
    assert KIND_CLASSES == ("none", "printed", "handwritten", "notes")


def test_empty_goes_with_none_or_notes():
    assert is_valid_pair("empty", "none")
    assert is_valid_pair("empty", "notes")
    assert not is_valid_pair("empty", "printed")
    assert not is_valid_pair("empty", "handwritten")


def test_digit_goes_with_printed_or_handwritten():
    assert is_valid_pair("7", "printed")
    assert is_valid_pair("7", "handwritten")
    assert not is_valid_pair("7", "none")
    assert not is_valid_pair("7", "notes")


def test_unknown_class_is_invalid():
    assert not is_valid_pair("10", "printed")
    assert not is_valid_pair("7", "typed")


def test_sizes_follow_the_contract():
    assert (CELL_SIZE, INPUT_SIZE, CROP, BATCH) == (64, 32, (6, 58), 81)


def test_digit_index_follows_class_order():
    assert (digit_index("empty"), digit_index("9")) == (0, 9)


def test_kind_index_follows_class_order():
    assert (kind_index("none"), kind_index("notes")) == (0, 3)


def test_unknown_kind_is_negative():
    assert UNKNOWN_KIND == -1
