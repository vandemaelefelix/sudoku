"""`just migrate-layout <old_ml_root> [--apply] [--force]`: copy the ADR-009 layout into the
ADR-018 layout. A dry run by default. It never moves, changes or deletes a file of the old tree.

Old: `<old>/datasets/{cells.csv,photos.csv,photo-checks.jsonl,cell-origins.csv}` and
`<old>/data/{cells,photos}`. New: `data/cells.csv`, `data/sudoku-photos.csv` and the image store.
The old kind log is not migrated: git keeps its history."""

import argparse
import csv
import json
import shutil
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from sudoku_ml.data_check import check_data, format_report
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.manifest import CELL_FIELDS, csv_text, pixel_id, write_atomic
from sudoku_ml.photo_import import PHOTO_FIELDS, PHOTO_SUFFIXES, format_corners

OLD_DECISIONS = ("accepted", "rejected", "too-few-cells", "legacy")


@dataclass(frozen=True)
class Plan:
    cells: list[list]  # rows of cells.csv, sorted
    photos: list[dict[str, str]]  # rows of sudoku-photos.csv, in the old order
    notes: list[str]  # facts for the person, not problems


def _old_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def _decisions(path: Path) -> dict[str, dict]:
    """Photo id → its newest decision line."""
    found: dict[str, dict] = {}
    if not path.exists():
        return found
    for number, text in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not text.strip():
            continue
        try:
            entry = json.loads(text)
            found[entry["photo"]] = entry
        except (json.JSONDecodeError, KeyError, TypeError) as error:
            raise ValueError(f"{path.name} line {number} is not a photo decision") from error
    return found


def _sources(path: Path) -> dict[str, tuple[str, str, str]]:
    sources: dict[str, tuple[str, str, str]] = {}
    for row in _old_rows(path):
        source = (row["photo"], row["row"], row["col"])
        if sources.get(row["cell"], source) != source:
            raise ValueError(f"cell {row['cell'][:16]} has two different sources in {path.name}")
        sources[row["cell"]] = source
    return sources


def build_plan(old: Path) -> Plan:
    """Raises ValueError when the old files contradict each other in a way that has no single
    answer."""
    datasets = old / "datasets"
    notes: list[str] = []
    sources = _sources(datasets / "cell-origins.csv")
    cells, listed = [], set()
    for row in _old_rows(datasets / "cells.csv"):
        cell_id, digit = row["id"], row["label"]
        # The old `none` kind of an empty cell is an empty column now.
        kind = "" if row.get("kind") in (None, "", "none") else row["kind"]
        source = sources.get(cell_id, ("", "", ""))
        cells.append([cell_id, digit, kind, *source])
        listed.add(cell_id)
    cells.sort(key=lambda r: (r[1], r[0]))
    dropped = sorted(set(sources) - listed)
    if dropped:
        notes.append(
            f"{len(dropped)} rows of cell-origins.csv name no cell of cells.csv, "
            f"e.g. {dropped[0][:16]}. They are not migrated."
        )
    decisions = _decisions(datasets / "photo-checks.jsonl")
    photos, undecided = [], 0
    for row in _old_rows(datasets / "photos.csv"):
        decision = decisions.get(row["id"])
        status = decision["decision"] if decision else "legacy"
        if status not in OLD_DECISIONS:
            raise ValueError(f"photo {row['id'][:16]}: unknown decision {status!r}")
        undecided += decision is None
        corners = ""
        if status == "accepted":
            corners = format_corners(decision["corners"])
        photos.append(
            {
                "photo_id": row["id"],
                "file": row["file"],
                "source": row["origin"],
                "licence": row.get("licence") or "none",
                "attribution": row.get("attribution") or "",
                "status": status,
                "corners": corners,
            }
        )
    if undecided:
        notes.append(f"{undecided} sudoku photos have no decision. They become legacy.")
    return Plan(cells, photos, notes)


def _inside(a: Path, b: Path) -> bool:
    a, b = a.resolve(), b.resolve()
    return a == b or b in a.parents


def _not_empty(path: Path) -> bool:
    return path.is_file() or (path.is_dir() and any(path.iterdir()))


def targets(paths: DataPaths) -> list[Path]:
    return [paths.cells_csv, paths.photos_csv, paths.cells, paths.photos]


def copy_tree(source: Path, target: Path) -> None:
    """Copy a folder. On macOS `cp -c` makes APFS clones: instant, and no extra space."""
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_dir():
        target.rmdir()
    if sys.platform == "darwin" and shutil.which("cp"):
        result = subprocess.run(["cp", "-cR", str(source), str(target)], capture_output=True)
        if result.returncode == 0:
            return
        if target.exists():
            shutil.rmtree(target)
    shutil.copytree(source, target, copy_function=shutil.copy2)


def verify_copies(source: Path, target: Path, files: list[Path], ids: dict[str, str]) -> list[str]:
    """Each of `files` (under `source`) exists under `target` with the pixel id that `ids` gives
    for its stem, and its stem is the start of that pixel id."""
    problems = []
    for old_file in files:
        copy = target / old_file.relative_to(source)
        if not copy.is_file():
            problems.append(f"{copy} was not copied")
            continue
        actual = pixel_id(copy)
        expected = ids.get(copy.stem)
        if (expected and actual != expected) or actual[:16] != copy.stem:
            problems.append(f"{copy} has the pixel id {actual[:16]}, not {copy.stem}")
    return problems


def _summary(plan: Plan, paths: DataPaths, old: Path) -> list[str]:
    statuses = Counter(p["status"] for p in plan.photos)
    digits = Counter(r[1] for r in plan.cells)
    return [
        f"From {old}",
        f"Cells: {len(plan.cells)} rows, {sum(bool(r[3]) for r in plan.cells)} with a source. "
        + ", ".join(f"{d} {n}" for d, n in sorted(digits.items())),
        f"Sudoku photos: {len(plan.photos)} rows. "
        + ", ".join(f"{s} {n}" for s, n in sorted(statuses.items())),
        f"Tables to {paths.root}, images to {paths.images}.",
        *plan.notes,
    ]


def main(argv: list[str], paths: DataPaths | None = None) -> int:
    parser = argparse.ArgumentParser(prog="just migrate-layout")
    parser.add_argument("old_ml_root", type=Path)
    parser.add_argument("--apply", action="store_true", help="write the new layout")
    parser.add_argument("--force", action="store_true", help="replace non-empty targets")
    args = parser.parse_args(argv)
    paths = paths or DataPaths.under()
    old: Path = args.old_ml_root
    old_cells, old_photos = old / "data" / "cells", old / "data" / "photos"
    if not (old / "datasets" / "cells.csv").is_file():
        print(f"{old} has no datasets/cells.csv. Give the old ml/ folder.", file=sys.stderr)
        return 1
    for new in (paths.images, paths.root):
        if _inside(new, old) or _inside(old / "data", new):
            print(f"{new} and the old tree {old} overlap. Choose other folders.", file=sys.stderr)
            return 1
    try:
        plan = build_plan(old)
    except (ValueError, KeyError) as error:
        print(f"The old files cannot be migrated: {error}", file=sys.stderr)
        return 1
    print("\n".join(_summary(plan, paths, old)))
    if not args.apply:
        print("Dry run: nothing was written. Add --apply to write the new layout.")
        return 0
    full = [t for t in targets(paths) if _not_empty(t)]
    if full and not args.force:
        names = ", ".join(str(t) for t in full)
        print(f"Refused: {names} are not empty. Add --force to replace them.", file=sys.stderr)
        return 1
    for target in full:
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
    if old_cells.is_dir():
        copy_tree(old_cells, paths.cells)
    if old_photos.is_dir():
        copy_tree(old_photos, paths.photos)
    write_atomic(paths.cells_csv, csv_text(CELL_FIELDS, plan.cells))
    write_atomic(paths.photos_csv, csv_text(PHOTO_FIELDS, plan.photos))
    cell_ids = {r[0][:16]: r[0] for r in plan.cells}
    photo_ids = {p["photo_id"][:16]: p["photo_id"] for p in plan.photos}
    old_photo_files = [
        p for p in sorted(old_photos.glob("*")) if p.suffix.lower() in PHOTO_SUFFIXES
    ]
    problems = verify_copies(old_cells, paths.cells, sorted(old_cells.glob("*/*.png")), cell_ids)
    problems += verify_copies(old_photos, paths.photos, old_photo_files, photo_ids)
    for problem in problems:
        print(problem, file=sys.stderr)
    report = check_data(paths)
    print(format_report(report))
    return 1 if problems or report["problems"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
