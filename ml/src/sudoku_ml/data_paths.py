"""Every path of the real dataset (ADR-018). The tables live in `ml/dataset/`.
The images live in `ml/dataset/images/`, or in the folder that `SUDOKU_IMAGES` names."""

import os
from dataclasses import dataclass
from pathlib import Path

ML_ROOT = Path(__file__).parents[2]
REPO_ROOT = ML_ROOT.parent
DATA_ROOT = ML_ROOT / "dataset"
ARTIFACTS = ML_ROOT / "artifacts"
TRAIN_CONFIG = ML_ROOT / "configs" / "cell-classifier.toml"
IMAGES_ENV = "SUDOKU_IMAGES"


def images_from_env(data_root: Path) -> Path:
    """`SUDOKU_IMAGES`, or `<data_root>/images`. A relative value starts at the repository root:
    `just` runs the Python commands in `ml/`, and `.env` lives at the root."""
    value = os.environ.get(IMAGES_ENV, "").strip()
    if not value:
        return data_root / "images"
    path = Path(value).expanduser()
    return path if path.is_absolute() else REPO_ROOT / path


@dataclass(frozen=True)
class DataPaths:
    root: Path  # ml/dataset/: the tracked tables and work/
    images: Path  # holds cells/ and sudoku-photos/
    config: Path = TRAIN_CONFIG  # its seed and split define the test split of the Check screen

    @classmethod
    def under(cls, data_root: Path = DATA_ROOT, images_root: Path | None = None) -> "DataPaths":
        return cls(
            data_root, images_root if images_root is not None else images_from_env(data_root)
        )

    # Tracked

    @property
    def cells_csv(self) -> Path:
        return self.root / "cells.csv"

    @property
    def photos_csv(self) -> Path:
        return self.root / "sudoku-photos.csv"

    @property
    def kind_checks(self) -> Path:
        return self.root / "kind-checks.jsonl"

    @property
    def status(self) -> Path:
        return self.root / "STATUS.md"

    # Images, not tracked (SUD-08)

    @property
    def cells(self) -> Path:
        return self.images / "cells"

    @property
    def photos(self) -> Path:
        return self.images / "sudoku-photos"

    # Work folder: not tracked. Every file except the journal is derived and safe to delete.

    @property
    def work(self) -> Path:
        return self.root / "work"

    @property
    def journal(self) -> Path:
        return self.work / "journal.jsonl"

    @property
    def prelabels(self) -> Path:
        return self.work / "prelabels.json"

    @property
    def detections(self) -> Path:
        return self.work / "detections.json"

    @property
    def suspects(self) -> Path:
        return self.work / "suspects.csv"

    @property
    def groups(self) -> Path:
        return self.work / "groups.json"

    @property
    def outline_scores(self) -> Path:
        return self.work / "outline-scores.json"

    @property
    def doubt(self) -> Path:
        return self.work / "doubt.json"

    @property
    def tmp(self) -> Path:
        return self.work / "tmp"
