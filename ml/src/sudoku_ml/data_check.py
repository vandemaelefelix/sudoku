"""Check that the real data agrees with its manifests, and print a short report (ADR-009).
Reads files only. It never changes a file."""

import csv
import json
import sys
from collections import Counter
from pathlib import Path

from sudoku_ml.dataset import FULL_ID
from sudoku_ml.kind_log import read_log
from sudoku_ml.label_store import Paths
from sudoku_ml.manifest import LABELS, pixel_id
from sudoku_ml.photo_import import PhotoPaths, read_photos

MAX_PROBLEMS = 20
_LINK_NOTE = (
    "Cells without a link come from before links existed, or from a cut that stopped part-way."
)


def link_line(linked: int, total: int) -> str:
    return f"Linked {linked} of {total} cells. {_LINK_NOTE}"


def _rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def _decisions(path: Path) -> dict[str, str]:
    """Photo id → its newest decision. Raises ValueError on a line that is not a decision."""
    found: dict[str, str] = {}
    if not path.exists():
        return found
    for number, text in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not text.strip():
            continue
        try:
            entry = json.loads(text)
            found[entry["photo"]] = entry["decision"]
        except (json.JSONDecodeError, KeyError, TypeError) as error:
            raise ValueError(f"{path.name} line {number} is not a photo decision") from error
    return found


def _cells(paths: Paths, problems: list[str]) -> dict[str, str]:
    """Full cell id → folder. Reports misnamed files and ids that appear twice."""
    found: dict[str, str] = {}
    where: dict[str, Path] = {}
    if paths.cells.exists():
        for folder in sorted(paths.cells.iterdir()):
            if folder.is_dir() and folder.name not in LABELS:
                problems.append(f"{folder} is not a known label folder")
    for path in sorted(paths.cells.glob("*/*.png")):
        try:
            cell_id = pixel_id(path)
        except (OSError, ValueError) as error:
            problems.append(f"{path} cannot be read: {error}")
            continue
        if path.stem != cell_id[:16]:
            problems.append(f"{path} is not named after its pixels ({cell_id[:16]})")
        if cell_id in found:
            problems.append(f"{path} has the same pixels as {where[cell_id]}")
            continue
        found[cell_id], where[cell_id] = path.parent.name, path
    return found


def _photos(photo_paths: PhotoPaths, problems: list[str]) -> set[str]:
    ids: set[str] = set()
    for row in read_photos(photo_paths.manifest):
        if row["id"] in ids:
            problems.append(f"photo {row['id'][:16]} is twice in {photo_paths.manifest.name}")
            continue
        ids.add(row["id"])
        path = photo_paths.photos / row["file"]
        if not path.exists():
            problems.append(f"photo file {path} does not exist")
            continue
        try:
            actual = pixel_id(path)
        except (OSError, ValueError) as error:
            problems.append(f"photo file {path} cannot be read: {error}")
            continue
        if actual != row["id"]:
            problems.append(f"photo file {path} has the id {actual[:16]}, not {row['id'][:16]}")
    return ids


def _manifest(paths: Paths, cells: dict[str, str], problems: list[str]) -> None:
    listed = {r["id"]: r["label"] for r in _rows(paths.manifest)}
    name = paths.manifest.name
    missing = sorted(set(cells) - set(listed))
    extra = sorted(set(listed) - set(cells))
    wrong = sorted(c for c in set(cells) & set(listed) if cells[c] != listed[c])
    for what, ids in (
        (f"cells on disk that {name} does not list", missing),
        (f"rows of {name} without a cell on disk", extra),
        (f"rows of {name} with another folder than the cell has", wrong),
    ):
        if ids:
            problems.append(f"{len(ids)} {what}, e.g. {ids[0][:16]}. Run: just dataset-manifest")


def _origins(
    photo_paths: PhotoPaths, cells: dict[str, str], photos: set[str], problems: list[str]
) -> set[str]:
    linked: set[str] = set()
    for row in _rows(photo_paths.origins):
        cell, photo = row["cell"], row["photo"]
        if cell not in cells:
            problems.append(f"origin of {cell[:16]}: the cell does not exist")
        if photo not in photos:
            problems.append(f"origin of {cell[:16]}: photo {photo[:16]} is not in photos.csv")
        if cell in linked:
            problems.append(f"cell {cell[:16]} has two origins")
        linked.add(cell)
    return linked & set(cells)


def _kind_log(paths: Paths, cells: dict[str, str], problems: list[str]) -> None:
    """Every cell id in the log is a full id of a cell that exists in some folder."""
    try:
        lines = read_log(paths.log)
    except (ValueError, KeyError, TypeError) as error:
        problems.append(f"{paths.log.name} cannot be read: {error}")
        return
    bad = sorted({x.cell for x in lines if not FULL_ID.fullmatch(x.cell)})
    gone = sorted({x.cell for x in lines if FULL_ID.fullmatch(x.cell) and x.cell not in cells})
    if bad:
        problems.append(f"{len(bad)} ids in {paths.log.name} are not full ids, e.g. {bad[0]}")
    if gone:
        problems.append(f"{len(gone)} ids in {paths.log.name} match no cell, e.g. {gone[0][:16]}")


def check_data(paths: Paths, photo_paths: PhotoPaths) -> dict:
    """Returns `problems` (empty when the data is sound) and the counts of the report."""
    problems: list[str] = []
    cells = _cells(paths, problems)
    photos = _photos(photo_paths, problems)
    _manifest(paths, cells, problems)
    linked = _origins(photo_paths, cells, photos, problems)
    _kind_log(paths, cells, problems)
    try:
        decisions = _decisions(photo_paths.checks)
    except ValueError as error:
        problems.append(str(error))
        decisions = {}
    for photo in decisions:
        if photo not in photos:
            problems.append(f"{photo_paths.checks.name}: photo {photo[:16]} is not in photos.csv")
    per_folder = Counter(cells.values())
    per_decision = Counter(decisions[p] for p in photos if p in decisions)
    pending = len(photos - set(decisions))
    return {
        "problems": problems,
        "cells": {label: per_folder[label] for label in LABELS if per_folder[label]},
        "photos": {**per_decision, "pending": pending},
        "linked": len(linked),
        "total_cells": len(cells),
        "link_line": link_line(len(linked), len(cells)),
        "waiting_cells": per_folder["unlabeled"],
        "pending_photos": pending,
    }


def format_report(report: dict) -> str:
    lines = []
    if report["problems"]:
        lines.append(f"{len(report['problems'])} problems:")
        lines += [f"- {p}" for p in report["problems"][:MAX_PROBLEMS]]
        if len(report["problems"]) > MAX_PROBLEMS:
            lines.append(f"- and {len(report['problems']) - MAX_PROBLEMS} more")
    else:
        lines.append("No problems.")
    lines.append("Cells: " + ", ".join(f"{k} {v}" for k, v in report["cells"].items()))
    lines.append("Photos: " + ", ".join(f"{k} {v}" for k, v in report["photos"].items()))
    lines.append(report["link_line"])
    lines.append(
        f"Waiting: {report['waiting_cells']} cells in unlabeled/, "
        f"{report['pending_photos']} photos pending."
    )
    return "\n".join(lines)


def main(ml_root: Path = Path(__file__).parents[2]) -> int:
    report = check_data(Paths.under(ml_root), PhotoPaths.under(ml_root))
    print(format_report(report))
    return 1 if report["problems"] else 0


if __name__ == "__main__":
    sys.exit(main())
