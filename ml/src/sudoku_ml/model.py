"""The cell classifier: a global-average-pooling CNN with a digit head and a kind head (ADR-006)."""

import json
from pathlib import Path

import torch
from torch import nn

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES


def _conv(c_in: int, c_out: int) -> list[nn.Module]:
    return [nn.Conv2d(c_in, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out), nn.ReLU()]


class CellClassifier(nn.Module):
    """Input (N, 1, 32, 32). Returns digit logits (N, 10) and kind logits (N, 4)."""

    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            *_conv(1, 16),
            *_conv(16, 16),
            nn.MaxPool2d(2),
            *_conv(16, 32),
            *_conv(32, 32),
            nn.MaxPool2d(2),
            *_conv(32, 64),
            *_conv(64, 64),
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Dropout(0.1),
        )
        self.digit = nn.Linear(64, len(DIGIT_CLASSES))
        self.kind = nn.Linear(64, len(KIND_CLASSES))

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        h = self.features(x)
        return self.digit(h), self.kind(h)


class ExportModel(nn.Module):
    """The contract's layout: NHWC input, named softmax outputs, the fitted temperature applied."""

    def __init__(self, model: CellClassifier, temperature: float = 1.0) -> None:
        super().__init__()
        self.model = model
        self.temperature = temperature

    def forward(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        digit, kind = self.model(x.permute(0, 3, 1, 2))
        return {"digit": (digit / self.temperature).softmax(dim=1), "kind": kind.softmax(dim=1)}


def read_metrics(run: Path) -> dict:
    return json.loads((run / "metrics.json").read_text())


def load_run(run: Path) -> tuple[CellClassifier, float]:
    """The trained model of a run folder, in eval mode on the CPU, and the temperature that
    calibrates its digit head."""
    model = CellClassifier()
    model.load_state_dict(torch.load(run / "model.pt", map_location="cpu"))
    return model.eval(), read_metrics(run)["temperature"]
