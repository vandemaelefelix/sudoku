"""Scan records, a fake table and bucket, and a pulled dataset for the scan tests."""

import io
from decimal import Decimal
from pathlib import Path

from cells import Clock
from photos import grid_photo
from PIL import Image

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.label_store import LabelStore
from sudoku_ml.pull_scans import pull_scans
from sudoku_ml.tables import read_photos, stem_of

SCAN_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
SCAN_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
CONTRIBUTOR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
CORNERS = [[0.2, 0.125], [0.74, 0.125], [0.74, 0.8], [0.2, 0.8]]


def jpeg(seed: int) -> bytes:
    out = io.BytesIO()
    Image.fromarray(grid_photo(seed=seed)).save(out, "JPEG", quality=95)
    return out.getvalue()


def record(scan_id: str, edited_cells: tuple[int, ...] = (), **changes) -> dict:
    """A scan record in DynamoDB form: numbers are Decimal, and the item has its keys."""
    cells = []
    for index in range(81):
        digit, kind = (0, 0) if index % 2 else (1 + index % 9, 1)
        digit_probs = [Decimal("0.01")] * 10
        digit_probs[digit] = Decimal("0.91")
        kind_probs = [Decimal("0.1")] * 4
        kind_probs[kind] = Decimal("0.7")
        cells.append(
            {
                "digitProbs": digit_probs,
                "kindProbs": kind_probs,
                "finalDigit": digit,
                "finalKind": kind,
                "edited": index in edited_cells,
            }
        )
    item = {
        "pk": f"CONTRIB#{CONTRIBUTOR}",
        "sk": f"SCAN#{scan_id}",
        "schemaVersion": 1,
        "scanId": scan_id,
        "contributorId": CONTRIBUTOR,
        "appVersion": "1.4.0",
        "modelVersion": "1.2.0",
        "corners": [[Decimal(str(v)) for v in point] for point in CORNERS],
        "cells": cells,
        "gsiPending": "PENDING",
        "createdAt": "2026-10-16T10:00:00.000Z",
        "expiresAt": 1792000000,
    }
    return {**item, **changes}


class FakeBucket:
    def __init__(self, objects: dict[str, bytes]):
        self.objects = objects
        self.asked: list[str] = []

    def get(self, key: str) -> bytes | None:
        self.asked.append(key)
        return self.objects.get(key)


class FakeTable:
    def __init__(self, items: list[dict]):
        self.items = items

    def pending(self) -> list[dict]:
        return [dict(i) for i in self.items if "gsiPending" in i]

    def clear_pending(self, pk: str, sk: str) -> None:
        for item in self.items:
            if (item["pk"], item["sk"]) == (pk, sk):
                item.pop("gsiPending", None)


def pulled(tmp_path: Path, corners=(CORNERS, CORNERS)) -> tuple[LabelStore, DataPaths, list[str]]:
    """A temporary dataset with one pulled scan per entry of `corners`, oldest first. Cell 2 of
    each scan is `app-edited`."""
    paths = DataPaths.under(tmp_path / "data", tmp_path / "images")
    paths.cells.mkdir(parents=True)
    ids = [SCAN_A, SCAN_B][: len(corners)]
    items = [
        record(
            scan,
            edited_cells=(2,),
            scanId=scan,
            corners=[[Decimal(str(v)) for v in point] for point in quad],
        )
        for scan, quad in zip(ids, corners, strict=True)
    ]
    bucket = FakeBucket({f"scans/{scan}.jpg": jpeg(n + 1) for n, scan in enumerate(ids)})
    pull_scans(paths, FakeTable(items), bucket)
    photos = [stem_of(p.photo_id) for p in read_photos(paths.photos_csv)]
    return LabelStore(paths, Clock()), paths, photos


def places(store: LabelStore, photo: str) -> list[str | None]:
    """The cell at each of the 81 places of a scan, or None."""
    return store.book.places(store.book.state(photo))


def own_cells(store: LabelStore, photo: str) -> list[str]:
    """The cells of the places of a scan that its own photo owns, each once."""
    owner = store.book.state(photo).row.photo_id
    sources = store.sources()
    found = [c for c in places(store, photo) if c and sources[c][0] == owner]
    return list(dict.fromkeys(found))


def shared_cells(store: LabelStore, photo: str) -> list[str]:
    """The cells at the places of a scan that another scan owns."""
    owner = store.book.state(photo).row.photo_id
    sources = store.sources()
    return [c for c in places(store, photo) if c and sources[c][0] != owner]


def old_page_confirm(store: LabelStore, photo: str) -> None:
    """The lines of the removed scan page after a confirm: a digit line of the screen "scans" for
    each own cell, also an unchanged one. Old journals hold them (ADR-034, decision 8)."""
    action = store.state.action()
    lines = [
        action.digit(c, store.folder[c], store.folder[c], "scans") for c in own_cells(store, photo)
    ]
    store.state.apply_digits(lines)
    store.state.write(lines)
