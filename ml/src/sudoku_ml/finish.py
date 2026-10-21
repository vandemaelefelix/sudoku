"""The Finish step of the labelling page (ADR-018): fold the journal into cells.csv, run the data
check, write STATUS.md, then delete the journal and the derived files in ml/dataset/work/. It never
touches the images. Of the tracked files it writes only cells.csv and STATUS.md."""

import json

from sudoku_ml.data_check import check_data, format_report
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.photo_import import read_detections, write_detections
from sudoku_ml.status import write_status
from sudoku_ml.tables import read_photos

PROBLEMS_SHOWN = 5


def _prelabel_run(store: LabelStore) -> str | None:
    try:
        return json.loads(store.paths.prelabels.read_text())["run"]
    except (OSError, ValueError, KeyError, TypeError):
        return None


def finish(store: LabelStore) -> dict:
    """Raises ValueError, with nothing deleted, when the data check finds a problem.

    cells.csv is rewritten before the check: the check compares it with the folders. The call
    may append `repair` lines to the journal through `store.repair()`. After a Finish, Undo
    cannot reverse the finished changes: git keeps the old tables. Finish closes every open
    Review item: the new `Last finish:` line is newer than their evidence. `review_closed` is
    their number, or None when the Review screen did not run in this session."""
    paths = store.paths
    try:
        closed = store.open_review_count()
        store.repair()
        write_cells_manifest(paths)
    except ValueError as error:
        raise ValueError(f"Finish stopped and deleted nothing. {error}") from error
    report = check_data(paths)
    if report["problems"]:
        shown = "; ".join(report["problems"][:PROBLEMS_SHOWN])
        more = len(report["problems"]) - PROBLEMS_SHOWN
        raise ValueError(
            f"Finish stopped and deleted nothing. {len(report['problems'])} problems: {shown}"
            + (f"; and {more} more. Run just check-data for the full list." if more > 0 else "")
        )
    write_status(paths.status, report, store.now(), _prelabel_run(store))
    removed = []
    for path in (paths.journal, paths.prelabels, paths.suspects, paths.groups):
        if path.exists():
            path.unlink()
            removed.append(path.name)
    store.groups = {}
    detections = read_detections(paths.detections)
    if detections:
        pending = {r.photo_id for r in read_photos(paths.photos_csv) if r.status == "pending"}
        kept = {k: v for k, v in detections.items() if k in pending}
        if not kept:
            paths.detections.unlink()
            removed.append(paths.detections.name)
        elif len(kept) < len(detections):
            write_detections(paths.detections, kept)
            removed.append(f"{paths.detections.name} (decided photos only)")
    elif paths.detections.exists():
        paths.detections.unlink()
        removed.append(paths.detections.name)
    return {
        "report": report,
        "text": format_report(report),
        "removed": removed,
        "review_closed": closed,
        "still_waiting": {
            "cells": report["waiting_cells"],
            "photos": report["pending_photos"],
        },
    }
