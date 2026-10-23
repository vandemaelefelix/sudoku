from pathlib import Path

import pytest
from cells import (
    Clock,
    Guess,
    add_cell,
    build,
    move_digit,
    pattern,
    prelabel,
    save_kinds,
    settle_kinds,
)
from scans import pulled, shared_cells

from sudoku_ml.check_steps import CHECK_SIZE
from sudoku_ml.finish import finish
from sudoku_ml.journal import read_journal
from sudoku_ml.label_store import LabelStore
from sudoku_ml.tables import read_cells, stem_of


def loose(tmp_path: Path, guesses: dict[int, Guess | None]):
    """Five cells in unlabeled/ that no scan holds, and one legacy cell in 3. guesses: index of
    a cell in unlabeled/ → its guess."""
    paths, ids = build(tmp_path, {"unlabeled": 5, "3": 1})
    u = ids["unlabeled"]
    prelabel(paths, {u[i]: g for i, g in guesses.items() if g})
    return LabelStore(paths, Clock()), paths, u, ids["3"][0]


GUESSES: dict[int, Guess | None] = {
    0: ("2", 0.99, "printed", 0.9),
    1: ("2", 0.5, "handwritten", 0.9),
    2: ("2", 0.985, "printed", 0.9),
    3: ("9", 0.8, "handwritten", 0.9),
    4: None,
}


def waiting(store: LabelStore) -> dict[str, dict]:
    return {c["id"]: c for c in store.open_cells()}


def approved(tmp_path: Path, scans: int = 1):
    store, paths, photos = pulled(
        tmp_path, corners=tuple([[[0.2, 0.125], [0.74, 0.125], [0.74, 0.8], [0.2, 0.8]]] * scans)
    )
    store.approve_outlines(photos)
    return store, paths, photos


def trust_labels(store: LabelStore, p: float = 0.999) -> None:
    """The model reads every open cell as it is labelled."""
    guesses = {
        c["id"]: (c["digit"], p, c["kind"] or "printed", 0.97)
        for c in [*store.open_cells(), *store.open_kind_cells()]
        if c["digit"]
    }
    prelabel(store.paths, guesses)


def test_the_open_digit_cells_are_the_cells_of_approved_scans_and_the_loose_cells(tmp_path: Path):
    store, paths, _ = approved(tmp_path)
    extra = add_cell(paths.cells, "unlabeled", pattern(91))
    store.register([extra])
    items = waiting(store)
    assert len(items) == 82 and items[extra]["source"] == "loose"
    assert (items[extra]["photo"], items[extra]["row"], items[extra]["col"]) == (None, None, None)
    assert {c["source"] for c in items.values()} == {"app", "loose"}
    scan_cell = next(c for c in items.values() if c["source"] == "app")
    assert scan_cell["photo"] and scan_cell["row"] is not None
    edited = [c for c in items.values() if c["edited"]]
    assert [(c["row"], c["col"]) for c in edited] == [(0, 2)]


def test_a_scan_that_is_not_approved_holds_no_open_cell(tmp_path: Path):
    store, _, photos = pulled(
        tmp_path, corners=([[0.2, 0.125], [0.74, 0.125], [0.74, 0.8], [0.2, 0.8]],)
    )
    assert store.open_cells() == []
    store.approve_outlines(photos)
    assert len(store.open_cells()) == 81


def test_a_pixel_identical_cell_is_shown_once(tmp_path: Path):
    store, _, photos = approved(tmp_path, scans=2)
    shared = set(shared_cells(store, photos[1]))
    assert shared
    seen = []
    for tab in ("empty", *map(str, range(1, 10)), "unknown"):
        seen += [c["id"] for c in store.check_digits(tab)["cells"]]
    assert len(seen) == len(set(seen)) == len(store.open_cells()) < 162
    assert shared <= set(seen)


def test_the_highest_doubt_comes_first_and_each_reason_is_named(tmp_path: Path):
    store, _, u, _ = loose(tmp_path, GUESSES)
    screen = store.check_digits("2")
    assert [c["id"] for c in screen["cells"]] == [u[1], u[2], u[0]]
    first = screen["cells"][0]
    assert first["doubt"] == pytest.approx(0.5) and first["reasons"] == [
        {"signal": "low-p", "p": 0.5}
    ]
    assert first["digit"] == "2" and first["kind"] == "handwritten" and not first["edited"]
    assert first["probs"]["digit"][2] == 0.5
    assert screen["cells"][2]["reasons"] == []
    assert (screen["left"], screen["sure"], screen["threshold"]) == (3, 2, 0.98)


def test_a_cell_without_a_guess_waits_in_the_unknown_tab_with_a_doubt_of_one(tmp_path: Path):
    store, _, u, _ = loose(tmp_path, GUESSES)
    screen = store.check_digits("unknown")
    [cell] = screen["cells"]
    assert cell["id"] == u[4] and cell["digit"] is None and cell["probs"] is None
    assert cell["doubt"] == 1 and cell["reasons"] == [{"signal": "no-guess"}]
    assert screen["counts"] == {
        "empty": 0,
        "1": 0,
        "2": 3,
        "3": 0,
        "4": 0,
        "5": 0,
        "6": 0,
        "7": 0,
        "8": 0,
        "9": 1,
        "unknown": 1,
    }
    assert screen["sure"] == 0


def test_a_legacy_labelled_cell_is_not_open(tmp_path: Path):
    store, _, u, legacy = loose(tmp_path, GUESSES)
    assert legacy not in waiting(store)
    assert store.check_digits("3")["left"] == 0


def test_a_page_holds_240_cells_and_left_counts_all(tmp_path: Path):
    paths, ids = build(tmp_path, {"unlabeled": CHECK_SIZE + 10})
    store = LabelStore(paths, Clock())
    screen = store.check_digits("unknown")
    assert len(screen["cells"]) == CHECK_SIZE and screen["left"] == CHECK_SIZE + 10


def test_a_digit_tab_and_a_threshold_are_checked(tmp_path: Path):
    store, _, _, _ = loose(tmp_path, GUESSES)
    with pytest.raises(ValueError, match="unknown digit"):
        store.check_digits("10")
    with pytest.raises(ValueError, match="unknown digit"):
        store.check_kinds("empty")
    for bad in (0, 1.5, -1):
        with pytest.raises(ValueError, match="threshold"):
            store.check_digits("2", bad)


def test_the_start_counts_and_the_model(tmp_path: Path):
    store, paths, u, _ = loose(tmp_path, GUESSES)
    status = store.status()
    assert (status["digit_cells"], status["kind_cells"]) == (5, 1)  # the legacy cell has no kind
    assert status["not_prelabelled"] == 2 and status["model"] == "test"
    assert status["outlines"] == 0 and status["changes"] == 0


def test_confirm_moves_the_cells_as_one_action_and_undo_puts_them_back(tmp_path: Path):
    store, paths, u, _ = loose(tmp_path, GUESSES)
    entries = [
        {"id": u[0], "digit": "2"},
        {"id": u[1], "digit": "9"},
        {"id": u[2], "digit": "discarded"},
        {"id": u[4], "digit": "empty"},
    ]
    assert store.confirm_digits(entries) == 4
    assert (paths.cells / "2" / f"{stem_of(u[0])}.png").exists()
    assert (paths.cells / "9" / f"{stem_of(u[1])}.png").exists()
    assert (paths.cells / "discarded" / f"{stem_of(u[2])}.png").exists()
    assert (paths.cells / "empty" / f"{stem_of(u[4])}.png").exists()
    lines = read_journal(paths.journal)
    assert {(x.screen, x.field) for x in lines} == {("digits", "digit")}
    assert len({x.action for x in lines}) == 1
    assert store.check_digits("2")["done"]["2"] == 1 and store.check_digits("2")["left"] == 0
    assert store.undo_target() == "digits"
    assert store.undo() == 4
    assert store.check_digits("2")["left"] == 3 and store.check_digits("2")["done"]["2"] == 0
    assert store.undo_target() is None


def test_a_move_to_empty_or_discarded_drops_the_kind(tmp_path: Path):
    store, paths, _ = approved(tmp_path)
    cells = [c for c in store.open_cells() if c["kind"] == "printed"][:2]
    entries = [
        {"id": cells[0]["id"], "digit": "empty"},
        {"id": cells[1]["id"], "digit": "discarded"},
    ]
    assert store.confirm_digits(entries) == 4
    assert [store.kinds()[c["id"]] for c in cells] == [None, None]
    assert store.undo() == 4
    assert [store.kinds()[c["id"]] for c in cells] == ["printed", "printed"]


def test_confirm_refuses_a_cell_that_is_not_open_and_writes_nothing(tmp_path: Path):
    store, paths, u, legacy = loose(tmp_path, GUESSES)
    for bad in (
        [{"id": u[0], "digit": "2"}, {"id": legacy, "digit": "3"}],
        [{"id": u[0], "digit": "2"}, {"id": u[0], "digit": "2"}],
        [{"id": u[0], "digit": "2"}, {"id": u[1], "digit": "unlabeled"}],
    ):
        with pytest.raises(ValueError):
            store.confirm_digits(bad)
    assert read_journal(paths.journal) == []
    assert len(list((paths.cells / "unlabeled").glob("*.png"))) == 5


def test_a_confirmed_scan_cell_is_verified_after_finish(tmp_path: Path):
    store, paths, _ = approved(tmp_path)
    [first, *rest] = store.open_cells()
    assert store.confirm_digits([{"id": first["id"], "digit": first["digit"]}]) == 1
    assert first["id"] not in waiting(store)
    settle_kinds(store)
    finish(store)
    rows = read_cells(paths.cells_csv)
    assert rows[first["id"]].label_source == "verified"
    assert all(rows[c["id"]].label_source != "verified" for c in rest)


def test_sure_confirms_the_cells_at_the_threshold_of_the_tab_only(tmp_path: Path):
    store, paths, u, _ = loose(tmp_path, GUESSES)
    assert store.check_digits("2", 0.96)["sure"] == 2
    assert store.check_digits("2", 0.995)["sure"] == 0
    assert store.sure_digits("2", 0.98) == 2
    lines = read_journal(paths.journal)
    assert {(x.cell, x.new, x.screen) for x in lines} == {
        (u[0], "2", "digits"),
        (u[2], "2", "digits"),
    }
    assert len({x.action for x in lines}) == 1
    assert [c["id"] for c in store.check_digits("2")["cells"]] == [u[1]]
    assert store.check_digits("9")["left"] == 1  # another tab stays
    assert store.sure_digits("unknown") == 0
    assert store.undo() == 2 and store.check_digits("2")["left"] == 3


def test_a_changed_label_a_rule_break_and_a_missing_guess_are_never_sure(tmp_path: Path):
    store, _, _ = approved(tmp_path)
    trust_labels(store)
    items = waiting(store)
    reasons = store.sudoku_reasons()
    broken = {c for c, found in reasons.items() if any(r["signal"] == "rule-break" for r in found)}
    edited = {c for c, item in items.items() if item["edited"]}
    assert broken and edited and edited & broken
    sure = {
        cell
        for tab in ("empty", *map(str, range(1, 10)))
        for cell in [c["id"] for c in store.check_digits(tab)["cells"]]
        if cell not in broken | edited
    }
    assert sum(store.check_digits(t)["sure"] for t in ("empty", *map(str, range(1, 10)))) == len(
        sure
    )
    assert len(sure) == 81 - len((broken | edited) & set(items))


def test_the_sudoku_signals_name_the_unit_and_come_with_the_scan_cells(tmp_path: Path):
    store, _, _ = approved(tmp_path)
    trust_labels(store)
    corner = next(c for c in store.open_cells() if (c["row"], c["col"]) == (0, 0))
    reasons = store.check_digits(corner["digit"])["cells"]
    found = next(c for c in reasons if c["id"] == corner["id"])["reasons"]
    assert {"signal": "rule-break", "unit": "col", "index": 0} in found
    assert {"signal": "rule-break", "unit": "box", "index": 0} in found
    assert not any(r.get("unit") == "row" for r in found)


def test_a_scan_that_is_not_unique_marks_its_empty_cells_only(tmp_path: Path, monkeypatch):
    store, _, _ = approved(tmp_path)
    monkeypatch.setattr(
        "sudoku_ml.sudoku_signals.scan_signals",
        lambda digits, givens: {"rule": {}, "not_unique": True},
    )
    marked = {c for c, found in store.sudoku_reasons().items() if {"signal": "not-unique"} in found}
    empty = {c["id"] for c in store.open_cells() if c["digit"] == "empty"}
    assert marked == empty and marked


def test_the_cut_and_the_signals_are_cached_by_corners_and_labels(tmp_path: Path, monkeypatch):
    store, paths, photos = approved(tmp_path)
    cuts, solves = [], []
    from sudoku_ml.sudoku_signals import scan_cut, scan_signals

    monkeypatch.setattr(
        "sudoku_ml.sudoku_signals.scan_cut", lambda *a: cuts.append(1) or scan_cut(*a)
    )
    monkeypatch.setattr(
        "sudoku_ml.sudoku_signals.scan_signals", lambda *a: solves.append(1) or scan_signals(*a)
    )
    store.sudoku_reasons()
    store.sudoku_reasons()
    assert (len(cuts), len(solves)) == (1, 1) and paths.doubt_scans.exists()
    again = LabelStore(paths, Clock())
    again.sudoku_reasons()
    assert (len(cuts), len(solves)) == (1, 1)
    cell = next(c for c in again.open_cells() if c["digit"] == "empty")
    again.confirm_digits([{"id": cell["id"], "digit": "5"}])
    again.sudoku_reasons()
    assert (len(cuts), len(solves)) == (1, 2)  # the labels changed, the corners did not
    paths.doubt_scans.write_text("{broken")
    assert LabelStore(paths, Clock()).sudoku_reasons() == again.sudoku_reasons()


def kind_store(tmp_path: Path):
    """Four cells of folder 7 without a kind, and a guess for three of them."""
    paths, ids = build(tmp_path, {"7": 4})
    c = ids["7"]
    prelabel(
        paths,
        {
            c[0]: ("7", 0.9, "printed", 0.99),
            c[1]: ("7", 0.9, "handwritten", 0.9),
            c[2]: ("7", 0.9, "printed", 0.6),
        },
    )
    return LabelStore(paths, Clock()), paths, c


def test_a_cell_in_1_to_9_without_a_kind_is_an_open_kind_cell(tmp_path: Path):
    store, _, c = kind_store(tmp_path)
    assert {x["id"] for x in store.open_kind_cells()} == set(c)
    assert store.check_kinds("7")["counts"]["7"] == 4
    assert store.check_kinds("7")["counts"] == {str(d): 4 if d == 7 else 0 for d in range(1, 10)}


def test_the_kind_step_puts_the_highest_doubt_first_and_starts_with_the_guess(tmp_path: Path):
    store, _, c = kind_store(tmp_path)
    screen = store.check_kinds("7")
    assert [x["id"] for x in screen["cells"]] == [c[3], c[2], c[1], c[0]]
    assert [x["kind"] for x in screen["cells"]] == [None, "printed", "handwritten", "printed"]
    assert [x["doubt"] for x in screen["cells"]] == pytest.approx([1, 0.4, 0.1, 0.01])
    assert screen["cells"][0]["reasons"] == [{"signal": "no-guess"}]
    assert screen["cells"][1]["reasons"] == [{"signal": "low-p", "p": 0.6}]
    assert (screen["sure"], screen["threshold"]) == (1, 0.95)
    assert store.check_kinds("7", 0.9)["sure"] == 2


def test_a_kind_the_model_reads_differently_adds_a_half(tmp_path: Path):
    store, paths, c = kind_store(tmp_path)
    save_kinds(store, [{"id": c[1], "kind": "printed"}], "kinds")
    digit_line(store, c[1])  # the player confirmed the digit: the kind is open again
    cell = next(x for x in store.check_kinds("7")["cells"] if x["id"] == c[1])
    assert cell["kind"] == "printed" and cell["doubt"] == 1
    assert cell["reasons"][0] == {"signal": "model-differs", "predicted": "handwritten", "p": 0.9}


def digit_line(store: LabelStore, cell: str, screen: str = "digits") -> str:
    """A digit line of a person, as the Digits step writes it for an unchanged cell."""
    action = store.state.action()
    folder = store.folder[cell]
    store.state.write([action.digit(cell, folder, folder, screen)])
    return action.id


def test_a_kind_confirm_is_one_action_and_closes_the_cells(tmp_path: Path):
    store, paths, c = kind_store(tmp_path)
    entries = [
        {"id": c[0], "kind": "printed"},
        {"id": c[1], "kind": "handwritten"},
        {"id": c[3], "kind": "unsure"},
    ]
    assert store.confirm_kinds(entries) == 3
    lines = read_journal(paths.journal)
    assert {(x.field, x.screen) for x in lines} == {("kind", "kinds")}
    assert len({x.action for x in lines}) == 1
    assert [x["id"] for x in store.open_kind_cells()] == [c[2]]
    assert store.check_kinds("7")["done"]["7"] == 3
    assert store.undo_target() == "kinds"
    assert store.undo() == 3 and len(store.open_kind_cells()) == 4


def test_a_kind_confirm_writes_a_line_for_an_unchanged_kind_too(tmp_path: Path):
    store, paths, c = kind_store(tmp_path)
    save_kinds(store, [{"id": c[0], "kind": "printed"}], "scans")
    digit_line(store, c[0])
    assert store.confirm_kinds([{"id": c[0], "kind": "printed"}]) == 1
    assert read_journal(paths.journal)[-1].old == "printed"
    assert c[0] not in {x["id"] for x in store.open_kind_cells()}


def test_a_confirmed_digit_with_a_kind_waits_for_the_kind_step(tmp_path: Path):
    store, _, c = kind_store(tmp_path)
    save_kinds(store, [{"id": c[0], "kind": "printed"}], "groups")  # an older screen set the kind
    assert c[0] not in {x["id"] for x in store.open_kind_cells()}
    action = digit_line(store, c[0], "scans")
    assert c[0] in {x["id"] for x in store.open_kind_cells()}
    save_kinds(store, [{"id": c[0], "kind": "handwritten"}], "review")
    assert c[0] not in {x["id"] for x in store.open_kind_cells()}
    digit_line(store, c[1], "outlines")  # a cut again is not a confirmation
    assert action and c[1] in {x["id"] for x in store.open_kind_cells()}


def test_an_undone_digit_confirm_does_not_open_the_kind(tmp_path: Path):
    store, _, c = kind_store(tmp_path)
    save_kinds(store, [{"id": c[0], "kind": "printed"}], "kinds")
    assert c[0] not in {x["id"] for x in store.open_kind_cells()}
    digit_line(store, c[0])
    assert c[0] in {x["id"] for x in store.open_kind_cells()}
    store.undo()
    assert c[0] not in {x["id"] for x in store.open_kind_cells()}


def test_the_digits_step_hands_its_cells_to_the_kind_step(tmp_path: Path):
    store, _, u, _ = loose(tmp_path, GUESSES)
    assert store.check_kinds("2")["left"] == 0
    store.confirm_digits([{"id": u[0], "digit": "2"}, {"id": u[3], "digit": "empty"}])
    screen = store.check_kinds("2")
    assert [(c["id"], c["kind"]) for c in screen["cells"]] == [(u[0], "printed")]
    assert store.status()["kind_cells"] == 2  # the legacy cell of 3 has no kind either
    assert u[3] not in {c["id"] for c in store.open_kind_cells()}


def test_a_cell_that_waits_for_its_digit_is_not_an_open_kind_cell(tmp_path: Path):
    store, _, _ = approved(tmp_path)
    assert store.open_kind_cells() == [] and store.status()["kind_cells"] == 0
    first = store.open_cells()[0]
    store.confirm_digits([{"id": first["id"], "digit": first["digit"]}])
    assert [c["id"] for c in store.open_kind_cells()] == [first["id"]]
    with pytest.raises(ValueError, match="not an open kind cell"):
        store.confirm_kinds([{"id": store.open_cells()[0]["id"], "kind": "printed"}])


def test_a_kind_confirm_refuses_a_cell_that_is_not_open_and_a_bad_kind(tmp_path: Path):
    store, paths, c = kind_store(tmp_path)
    with pytest.raises(ValueError, match="unknown kind"):
        store.confirm_kinds([{"id": c[0], "kind": "notes"}])
    with pytest.raises(ValueError, match="not an open kind cell"):
        store.confirm_kinds([{"id": "f" * 64, "kind": "printed"}])
    assert read_journal(paths.journal) == []


def test_sure_kinds_confirms_the_cells_at_the_threshold(tmp_path: Path):
    store, paths, c = kind_store(tmp_path)
    assert store.sure_kinds("7") == 1
    [line] = read_journal(paths.journal)
    assert (line.cell, line.new, line.screen) == (c[0], "printed", "kinds")
    assert store.sure_kinds("7") == 0
    assert store.sure_kinds("7", 0.9) == 1  # the handwritten cell with 0.9
    assert {x["id"] for x in store.open_kind_cells()} == {c[2], c[3]}
    with pytest.raises(ValueError, match="unknown digit"):
        store.sure_kinds("unknown")


def test_a_kind_tab_shows_the_cells_of_that_kind_with_the_counts_of_the_digit(tmp_path: Path):
    store, _, c = kind_store(tmp_path)
    everything = store.check_kinds("7")
    assert everything["kind_counts"] == {"all": 4, "printed": 2, "handwritten": 1, "unsure": 0}
    printed = store.check_kinds("7", kind="printed")
    assert [x["id"] for x in printed["cells"]] == [c[2], c[0]]  # the highest doubt first
    assert (printed["left"], printed["sure"]) == (2, 1)
    assert printed["kind_counts"] == everything["kind_counts"]
    assert printed["counts"] == everything["counts"]
    handwritten = store.check_kinds("7", 0.9, kind="handwritten")
    assert ([x["id"] for x in handwritten["cells"]], handwritten["sure"]) == ([c[1]], 1)
    unsure = store.check_kinds("7", kind="unsure")
    assert (unsure["cells"], unsure["left"], unsure["sure"]) == ([], 0, 0)


def test_the_kind_counts_follow_the_open_cells(tmp_path: Path):
    store, _, c = kind_store(tmp_path)
    store.confirm_kinds([{"id": c[1], "kind": "unsure"}])
    counts = store.check_kinds("7")["kind_counts"]
    assert counts == {"all": 3, "printed": 2, "handwritten": 0, "unsure": 0}
    assert store.check_kinds("3")["kind_counts"] == {
        "all": 0,
        "printed": 0,
        "handwritten": 0,
        "unsure": 0,
    }


def test_an_unknown_kind_is_refused(tmp_path: Path):
    store, paths, _ = kind_store(tmp_path)
    with pytest.raises(ValueError, match="unknown kind"):
        store.check_kinds("7", kind="notes")
    with pytest.raises(ValueError, match="unknown kind"):
        store.sure_kinds("7", kind="all")
    assert read_journal(paths.journal) == []


def test_sure_kinds_with_a_kind_confirms_only_those_cells(tmp_path: Path):
    store, paths, c = kind_store(tmp_path)
    assert store.sure_kinds("7", 0.5, kind="handwritten") == 1
    [line] = read_journal(paths.journal)
    assert (line.cell, line.new) == (c[1], "handwritten")
    assert store.sure_kinds("7", 0.5, kind="handwritten") == 0
    assert store.sure_kinds("7", 0.5, kind="printed") == 2
    assert {x["id"] for x in store.open_kind_cells()} == {c[3]}


def test_cells_that_the_model_reads_differently_come_in_the_order_of_the_raw_sum(tmp_path: Path):
    # Every such cell has a doubt of 1. A clamp would sort them by id.
    paths, ids = build(tmp_path, {"7": 3})
    store = LabelStore(paths, Clock())
    cells = ids["7"]
    save_kinds(store, [{"id": c, "kind": "printed"} for c in cells])
    for cell in cells:
        move_digit(store, cell, "6", "digits")
    p_label = {cells[0]: 0.4, cells[1]: 0.2, cells[2]: 0.01}
    prelabel(paths, {c: ("6", 0.99, "handwritten", 1 - p) for c, p in p_label.items()})
    screen = LabelStore(paths, Clock()).check_kinds("6")
    ordered = [c["id"] for c in screen["cells"]]
    assert ordered == [cells[2], cells[1], cells[0]]
    assert {c["doubt"] for c in screen["cells"]} == {1}
    assert all("raw" not in c for c in screen["cells"])
