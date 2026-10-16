"""`just migrate-layout <old_ml_root> [--apply] [--force] [--prefer-log]`: copy the ADR-009
layout into the ADR-018 layout. A dry run by default. It never moves, changes or deletes a file
of the old tree.

Old: `<old>/datasets/{cells.csv,photos.csv,photo-checks.jsonl,cell-origins.csv,kind-log.jsonl,
kind-check.jsonl}` and `<old>/data/{cells,photos}`. New: `ml/dataset/cells.csv`,
`ml/dataset/sudoku-photos.csv`, `ml/dataset/kind-checks.jsonl` and the image store. The kind log is
replayed to check the kind column of the old cells.csv. It is not copied: git keeps its history."""

import argparse
import csv
import json
import shutil
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from sudoku_ml.data_check import check_data, format_report
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.manifest import CELL_FIELDS, NO_KIND_FOLDERS, csv_text, pixel_id, write_atomic
from sudoku_ml.photo_import import PHOTO_FIELDS, PHOTO_SUFFIXES, format_corners, parse_corners

OLD_DECISIONS = ("accepted", "rejected", "too-few-cells", "legacy")
EXAMPLES = 10
REVIEW_NOTE = "Open Review items are closed by this migration. Run just suspects to find new ones."


@dataclass
class Plan:
    cells: list[list] = field(default_factory=list)  # rows of cells.csv, sorted
    photos: list[dict[str, str]] = field(default_factory=list)  # in the old order
    notes: list[str] = field(default_factory=list)  # facts for the person, not problems


def _old_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def _json_lines(path: Path) -> list[tuple[int, dict]]:
    found = []
    for number, text in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not text.strip():
            continue
        try:
            entry = json.loads(text)
        except json.JSONDecodeError as error:
            raise ValueError(f"{path.name} line {number} is not JSON") from error
        if not isinstance(entry, dict):
            raise ValueError(f"{path.name} line {number} is not a JSON object")
        found.append((number, entry))
    return found


def _decisions(path: Path) -> dict[str, dict]:
    """Photo id → its newest decision line."""
    found: dict[str, dict] = {}
    for number, entry in _json_lines(path):
        if "photo" not in entry or "decision" not in entry:
            raise ValueError(f"{path.name} line {number} is not a photo decision")
        found[entry["photo"]] = entry
    return found


def replay_kinds(path: Path) -> dict[str, str | None]:
    """The rule of the old kind log (ADR-009): the newest `kind` line of a cell gives its kind.
    An undo line is a kind line too: it carries the value that it restores."""
    kinds: dict[str, str | None] = {}
    for number, entry in _json_lines(path):
        if entry.get("field") != "kind":
            continue
        if "cell" not in entry or "new" not in entry:
            raise ValueError(f"{path.name} line {number} is not a kind line")
        kinds[entry["cell"]] = entry["new"]
    return kinds


def logged_kind(digit: str, logged: str | None) -> str:
    """The kind column that the old manifest wrote for a logged kind. Cells in empty/,
    unlabeled/ and discarded/ have no kind."""
    return "" if digit in NO_KIND_FOLDERS else logged or ""


def _sources(path: Path) -> dict[str, tuple[str, str, str]]:
    sources: dict[str, tuple[str, str, str]] = {}
    for row in _old_rows(path):
        source = (row["photo"], row["row"], row["col"])
        if sources.get(row["cell"], source) != source:
            raise ValueError(f"cell {row['cell'][:16]} has two different sources in {path.name}")
        sources[row["cell"]] = source
    return sources


def _optional(path: Path, notes: list[str], what: str) -> bool:
    if path.exists():
        return True
    notes.append(f"Note: no datasets/{path.name}: {what}.")
    return False


def _cells(datasets: Path, plan: Plan, prefer_log: bool) -> None:
    sources = {}
    if _optional(datasets / "cell-origins.csv", plan.notes, "no cell gets a source"):
        sources = _sources(datasets / "cell-origins.csv")
    log = datasets / "kind-log.jsonl"
    replayed = (
        replay_kinds(log) if _optional(log, plan.notes, "the kinds are not checked") else None
    )
    listed, mismatches = set(), []
    for row in _old_rows(datasets / "cells.csv"):
        cell_id, digit = row["id"], row["label"]
        # The old `none` kind of an empty cell is an empty column now.
        kind = "" if row.get("kind") in (None, "", "none") else row["kind"]
        if replayed is not None:
            from_log = logged_kind(digit, replayed.get(cell_id))
            if from_log != kind:
                mismatches.append((cell_id, digit, kind, from_log))
                if prefer_log:
                    kind = from_log
        plan.cells.append([cell_id, digit, kind, *sources.get(cell_id, ("", "", ""))])
        listed.add(cell_id)
    plan.cells.sort(key=lambda r: (r[1], r[0]))
    if mismatches and not prefer_log:
        examples = "; ".join(
            f"{c[:16]} in {d}/: table {k or '(none)'}, log {lg or '(none)'}"
            for c, d, k, lg in mismatches[:EXAMPLES]
        )
        raise ValueError(
            f"{len(mismatches)} kinds of cells.csv differ from the replayed kind-log.jsonl, "
            f"e.g. {examples}. Rewrite the old cells.csv first, or add --prefer-log to use the "
            "kinds of the log."
        )
    checked = len(plan.cells) if replayed is not None else 0
    line = f"kinds: {checked} cells checked, {len(mismatches)} mismatches"
    plan.notes.append(line + (" (the log wins)" if mismatches else ""))
    dropped = sorted(set(sources) - listed)
    if dropped:
        plan.notes.append(
            f"{len(dropped)} rows of cell-origins.csv name no cell of cells.csv, "
            f"e.g. {dropped[0][:16]}. They are not migrated."
        )


def _photos(datasets: Path, plan: Plan) -> None:
    if not (datasets / "photos.csv").exists():
        plan.notes.append("WARNING: no datasets/photos.csv: no sudoku photos are migrated.")
        return
    decisions = {}
    checks = datasets / "photo-checks.jsonl"
    if _optional(checks, plan.notes, "every sudoku photo is pending"):
        decisions = _decisions(checks)
    no_corners, pending = [], 0
    for row in _old_rows(datasets / "photos.csv"):
        decision = decisions.get(row["id"])
        # The old Photos screen offered every photo without a decision: it was pending.
        status = decision["decision"] if decision else "pending"
        if decision and status not in OLD_DECISIONS:
            raise ValueError(f"photo {row['id'][:16]}: unknown decision {status!r}")
        pending += status == "pending"
        corners = ""
        if status == "accepted":
            try:
                corners = format_corners(decision.get("corners"))
                parse_corners(corners)
            except (TypeError, ValueError):
                no_corners.append(row["id"][:16])
        plan.photos.append(
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
    if no_corners:
        raise ValueError(
            f"{len(no_corners)} accepted sudoku photos have no 4 corners in photo-checks.jsonl: "
            + ", ".join(no_corners[:EXAMPLES])
            + ". The data check needs them. Fix the decision lines first."
        )
    if pending:
        plan.notes.append(f"{pending} sudoku photos have no decision. They stay pending.")


def build_plan(old: Path, prefer_log: bool = False) -> Plan:
    """Raises ValueError when the old files contradict each other in a way that has no single
    answer."""
    datasets = old / "datasets"
    plan = Plan()
    _cells(datasets, plan, prefer_log)
    _photos(datasets, plan)
    if (datasets / "kind-check.jsonl").exists():
        plan.notes.append("datasets/kind-check.jsonl becomes ml/dataset/kind-checks.jsonl.")
    plan.notes.append(REVIEW_NOTE)
    return plan


def _inside(a: Path, b: Path) -> bool:
    """`a` is `b` or lies inside it, after the symlinks are resolved."""
    a, b = a.resolve(), b.resolve()
    return a == b or b in a.parents


def overlap(paths: DataPaths, old: Path) -> str | None:
    for new in (paths.images, paths.root):
        for part in (old, old / "data", old / "datasets"):
            if _inside(new, part) or _inside(part, new):
                return f"{new} and {part} (resolved: {part.resolve()}) overlap"
    return None


def _not_empty(path: Path) -> bool:
    return path.is_file() or (path.is_dir() and any(path.iterdir()))


def targets(paths: DataPaths) -> list[Path]:
    return [paths.cells_csv, paths.photos_csv, paths.cells, paths.photos]


def _image_stems(cells: Path, photos: Path) -> set[str]:
    found = {p.stem for p in cells.glob("*/*.png")}
    return found | {p.stem for p in photos.glob("*") if p.suffix.lower() in PHOTO_SUFFIXES}


def foreign_images(paths: DataPaths, old_cells: Path, old_photos: Path) -> list[str]:
    """Stems of the image files in the new store that the old tree does not hold. --force would
    delete them, and they are not in git."""
    return sorted(_image_stems(paths.cells, paths.photos) - _image_stems(old_cells, old_photos))


def copy_tree(source: Path, target: Path) -> None:
    """Copy a folder and the content of every symlink in it. On macOS `cp -c` makes APFS
    clones: instant, and no extra space. Raises ValueError if the copy holds a symlink."""
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_dir():
        target.rmdir()
    copied = False
    if sys.platform == "darwin" and shutil.which("cp"):
        result = subprocess.run(["cp", "-cRL", str(source), str(target)], capture_output=True)
        copied = result.returncode == 0
        if not copied and target.exists():
            shutil.rmtree(target)
    if not copied:
        shutil.copytree(source, target, copy_function=shutil.copy2)
    links = [p for p in target.rglob("*") if p.is_symlink()]
    if target.is_symlink() or links:
        raise ValueError(f"the copy {target} holds symlinks, e.g. {(links or [target])[0]}")


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


def _clear_targets(paths: DataPaths, force: bool, old_cells: Path, old_photos: Path) -> bool:
    full = [t for t in targets(paths) if _not_empty(t)]
    if not full:
        return True
    names = ", ".join(str(t) for t in full)
    if not force:
        print(f"Refused: {names} are not empty. Add --force to replace them.", file=sys.stderr)
        return False
    foreign = foreign_images(paths, old_cells, old_photos)
    if foreign:
        print(
            f"Refused: the image store {paths.images} holds {len(foreign)} images that the old "
            f"tree does not hold, e.g. {', '.join(foreign[:3])}. --force would delete them, and "
            "they are not in git. Move them away first.",
            file=sys.stderr,
        )
        return False
    print(f"--force deletes: {names}. The old tree holds every image of the store.")
    for target in full:
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
    return True


def apply(plan: Plan, paths: DataPaths, old: Path, force: bool) -> int:
    old_cells = (old / "data" / "cells").resolve()
    old_photos = (old / "data" / "photos").resolve()
    if not _clear_targets(paths, force, old_cells, old_photos):
        return 1
    try:
        if old_cells.is_dir():
            copy_tree(old_cells, paths.cells)
        if old_photos.is_dir():
            copy_tree(old_photos, paths.photos)
    except ValueError as error:
        print(f"Refused: {error}. Remove the copy before the next run.", file=sys.stderr)
        return 1
    write_atomic(paths.cells_csv, csv_text(CELL_FIELDS, plan.cells))
    write_atomic(paths.photos_csv, csv_text(PHOTO_FIELDS, plan.photos))
    old_checks = old / "datasets" / "kind-check.jsonl"
    if old_checks.exists() and not paths.kind_checks.exists():
        shutil.copy2(old_checks, paths.kind_checks)
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
    print(REVIEW_NOTE)
    return 1 if problems or report["problems"] else 0


def main(argv: list[str], paths: DataPaths | None = None) -> int:
    parser = argparse.ArgumentParser(prog="just migrate-layout")
    parser.add_argument("old_ml_root")
    parser.add_argument("--apply", action="store_true", help="write the new layout")
    parser.add_argument("--force", action="store_true", help="replace non-empty targets")
    parser.add_argument(
        "--prefer-log", action="store_true", help="use the replayed kinds of the kind log"
    )
    args = parser.parse_args(argv)
    if not args.old_ml_root.strip():
        print("Give the old ml/ folder, for example: just migrate-layout ml", file=sys.stderr)
        return 2
    paths = paths or DataPaths.under()
    old = Path(args.old_ml_root)
    if not (old / "datasets" / "cells.csv").is_file():
        print(f"{old} has no datasets/cells.csv. Give the old ml/ folder.", file=sys.stderr)
        return 1
    found = overlap(paths, old)
    if found:
        print(f"Refused: {found}. Choose other folders.", file=sys.stderr)
        return 1
    try:
        plan = build_plan(old, args.prefer_log)
    except (ValueError, KeyError) as error:
        print(f"The old files cannot be migrated: {error}", file=sys.stderr)
        return 1
    print("\n".join(_summary(plan, paths, old)))
    if not args.apply:
        print("Dry run: nothing was written. Add --apply to write the new layout.")
        return 0
    return apply(plan, paths, old, args.force)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
