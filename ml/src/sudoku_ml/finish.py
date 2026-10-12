"""The Finish step of the labelling page: check the data, rewrite cells.csv and delete the
derived files in ml/data/work/ (ADR-009). It never touches cells/, photos/ or datasets/ except
the cells.csv rewrite."""

import json

from sudoku_ml.data_check import check_data, format_report
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.photo_import import PhotoPaths, read_detections, write_detections

PROBLEMS_SHOWN = 5


def _decided(photo_paths: PhotoPaths) -> set[str]:
    # The same rule as PhotoCheck: a photo with any line in photo-checks.jsonl is decided.
    if not photo_paths.checks.exists():
        return set()
    lines = photo_paths.checks.read_text(encoding="utf-8").splitlines()
    return {json.loads(line)["photo"] for line in lines if line.strip()}


def finish(store: LabelStore, photo_paths: PhotoPaths) -> dict:
    """Raises ValueError, with nothing deleted, when the data check finds a problem.

    The manifest is rewritten before the check: the check compares it with the folders, and a
    session always leaves it behind. The rewrite only reads the folders and the log."""
    paths = store.paths
    store.repair()
    try:
        write_cells_manifest(paths.cells, paths.manifest, paths.log)
    except ValueError as error:
        raise ValueError(f"Finish stopped and deleted nothing. {error}") from error
    report = check_data(paths, photo_paths)
    if report["problems"]:
        shown = "; ".join(report["problems"][:PROBLEMS_SHOWN])
        more = len(report["problems"]) - PROBLEMS_SHOWN
        raise ValueError(
            f"Finish stopped and deleted nothing. {len(report['problems'])} problems: {shown}"
            + (f"; and {more} more. Run just check-data for the full list." if more > 0 else "")
        )
    removed = []
    derived = (paths.prelabels, paths.suspects, paths.groups)
    for path in (p for p in derived if p is not None and p.exists()):
        path.unlink()
        removed.append(path.name)
    store.groups = {}
    detections = read_detections(photo_paths.detections)
    if detections:
        decided = _decided(photo_paths)
        pending = {k: v for k, v in detections.items() if k not in decided}
        if not pending:
            photo_paths.detections.unlink()
            removed.append(photo_paths.detections.name)
        elif len(pending) < len(detections):
            write_detections(photo_paths.detections, pending)
            removed.append(f"{photo_paths.detections.name} (decided photos only)")
    elif photo_paths.detections.exists():
        photo_paths.detections.unlink()
        removed.append(photo_paths.detections.name)
    return {
        "report": report,
        "text": format_report(report),
        "removed": removed,
        "still_waiting": {
            "cells": report["waiting_cells"],
            "photos": report["pending_photos"],
        },
    }
