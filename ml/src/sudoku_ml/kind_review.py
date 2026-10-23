"""Review items: cells whose label a check doubts. The near-duplicate, model and blind checks."""

import csv
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sudoku_ml.journal import Field, Line, Screen, format_time, undone_actions
from sudoku_ml.kind_check import CheckLine

Current = Callable[[str, str], str | None]
_LABELLED = {"printed", "handwritten"}


@dataclass(frozen=True)
class ReviewItem:
    cell: str
    field: Field
    reason: str  # "near-duplicate", "kind-model", "digit-model" or "check"
    evidence: dict
    since: str  # time of the evidence. A review line at or after it closes the item


def near_duplicate_items(
    pairs: list[tuple[str, str]], kinds: dict[str, str | None], lines: list[Line]
) -> list[ReviewItem]:
    """Only direct pairs count: chains of near-duplicates join cells that do not look alike.
    The evidence time is the newest kind change in the journal. A pair of finished kinds has
    none, so it stays closed until one of its kinds changes."""
    changed = {x.cell: x.t for x in lines if x.field == Field.KIND and x.screen != Screen.REVIEW}
    items = []
    for pair in pairs:
        cells = sorted(pair)
        if len({kinds.get(c) for c in cells} & _LABELLED) < 2:
            continue
        since = max(changed.get(c, "") for c in cells)
        evidence = {"group": cells, "kinds": {c: kinds.get(c) for c in cells}}
        items += [ReviewItem(c, Field.KIND, "near-duplicate", evidence, since) for c in cells]
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
        ReviewItem(c.cell, Field.KIND, "check", {"label": c.label, "answer": c.answer}, c.t)
        for c in checks
        if c.answer != c.label and current(c.cell, Field.KIND) == c.label
    ]


def open_items(
    items: list[ReviewItem], lines: list[Line], last_finish: str = ""
) -> list[ReviewItem]:
    """Items whose evidence is newer than the last Finish and than their newest review line.
    Finish closes every open item (ADR-018)."""
    undone = undone_actions(lines)
    reviewed: dict[tuple[str, str], str] = {}
    for x in lines:
        if x.screen == Screen.REVIEW and x.action not in undone:
            reviewed[(x.cell, x.field)] = max(reviewed.get((x.cell, x.field), ""), x.t)
    return [
        i for i in items if i.since > last_finish and reviewed.get((i.cell, i.field), "") < i.since
    ]
