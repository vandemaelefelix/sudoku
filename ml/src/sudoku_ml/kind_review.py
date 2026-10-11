"""Review items: cells whose label a check doubts. The near-duplicate, model and blind checks."""

import csv
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sudoku_ml.kind_check import CheckLine
from sudoku_ml.kind_log import Line, current_kinds, format_time

Current = Callable[[str, str], str | None]
_LABELLED = {"printed", "handwritten"}


@dataclass(frozen=True)
class ReviewItem:
    cell: str
    field: str  # "kind" or "digit"
    reason: str  # "near-duplicate", "kind-model", "digit-model" or "check"
    evidence: dict
    since: str  # time of the evidence. A review line at or after it closes the item


def near_duplicate_items(dup_group: dict[str, int], lines: list[Line]) -> list[ReviewItem]:
    kinds = current_kinds(lines)
    changed = {x.cell: x.t for x in lines if x.field == "kind" and x.screen != "review"}
    members: dict[int, list[str]] = defaultdict(list)
    for cell, group in dup_group.items():
        members[group].append(cell)
    items = []
    for cells in members.values():
        cells.sort()
        if len({kinds.get(c) for c in cells} & _LABELLED) < 2:
            continue
        since = max(changed.get(c, "") for c in cells)
        evidence = {"group": cells, "kinds": {c: kinds.get(c) for c in cells}}
        items += [ReviewItem(c, "kind", "near-duplicate", evidence, since) for c in cells]
    return items


def model_items(
    suspects_csv: Path, stem_to_id: dict[str, str], current: Current
) -> list[ReviewItem]:
    """Rows of suspects.csv whose label still holds. The file time is the evidence time."""
    if not suspects_csv.exists():
        return []
    since = format_time(datetime.fromtimestamp(suspects_csv.stat().st_mtime, UTC))
    items = []
    with suspects_csv.open(newline="") as handle:
        reader = csv.DictReader(handle)
        if "field" not in (reader.fieldnames or ()):
            raise ValueError(f"{suspects_csv} has the old format. Run: just suspects")
        for row in reader:
            cell = stem_to_id.get(row["file"])
            if cell is None or current(cell, row["field"]) != row["label"]:
                continue
            evidence = {
                "label": row["label"],
                "predicted": row["predicted"],
                "p_label": float(row["p_label"]),
                "p_predicted": float(row["p_predicted"]),
            }
            items.append(ReviewItem(cell, row["field"], f"{row['field']}-model", evidence, since))
    return items


def check_items(checks: list[CheckLine], current: Current) -> list[ReviewItem]:
    return [
        ReviewItem(c.cell, "kind", "check", {"label": c.label, "answer": c.answer}, c.t)
        for c in checks
        if c.answer != c.label and current(c.cell, "kind") == c.label
    ]


def open_items(items: list[ReviewItem], lines: list[Line]) -> list[ReviewItem]:
    reviewed: dict[tuple[str, str], str] = {}
    for x in lines:
        if x.screen == "review":
            reviewed[(x.cell, x.field)] = max(reviewed.get((x.cell, x.field), ""), x.t)
    return [i for i in items if reviewed.get((i.cell, i.field), "") < i.since]
