"""The input steps of the model contract. The app implements the same maths in TypeScript."""

import numpy as np
import torch

from sudoku_ml.contract import CELL_SIZE, CROP, INPUT_SIZE

BT601 = (0.299, 0.587, 0.114)


def area_weights(src: int, dst: int) -> np.ndarray:
    """Exact area-average weights: W[i][j] is the overlap of source pixel j with output pixel i."""
    scale = src / dst
    weights = np.zeros((dst, src), dtype=np.float64)
    for i in range(dst):
        lo, hi = i * scale, (i + 1) * scale
        for j in range(int(np.floor(lo)), int(np.ceil(hi))):
            overlap = min(hi, j + 1) - max(lo, j)
            if overlap > 0:
                weights[i, j] = overlap / scale
    return weights.astype(np.float32)


_START, _END = CROP
_W = area_weights(_END - _START, INPUT_SIZE)
_W_TORCH = torch.from_numpy(_W)


def preprocess_cell(cell: np.ndarray) -> np.ndarray:
    """A (64, 64, 3) uint8 RGB cell image → the (32, 32) float32 model input."""
    if cell.shape != (CELL_SIZE, CELL_SIZE, 3) or cell.dtype != np.uint8:
        raise ValueError(f"expected a ({CELL_SIZE}, {CELL_SIZE}, 3) uint8 image, got {cell.shape}")
    gray = cell.astype(np.float32) @ np.array(BT601, dtype=np.float32)
    crop = gray[_START:_END, _START:_END]
    return (1.0 - (_W @ crop @ _W.T) / 255.0).astype(np.float32)


def preprocess_batch(cells: torch.Tensor) -> torch.Tensor:
    """(B, 3, 64, 64) float in [0, 255] → (B, 1, 32, 32) float32, on the same device."""
    r, g, b = cells[:, 0], cells[:, 1], cells[:, 2]
    gray = BT601[0] * r + BT601[1] * g + BT601[2] * b
    crop = gray[:, _START:_END, _START:_END]
    w = _W_TORCH.to(cells.device)
    resized = torch.einsum("ij,bjk,lk->bil", w, crop, w)
    return (1.0 - resized / 255.0).unsqueeze(1).float()


def to_cell_image(rgb: np.ndarray) -> np.ndarray:
    """Resize an (H, W, 3) uint8 image to a 64 × 64 cell image with the same area average."""
    if rgb.shape[:2] == (CELL_SIZE, CELL_SIZE):
        return rgb
    wy = area_weights(rgb.shape[0], CELL_SIZE)
    wx = area_weights(rgb.shape[1], CELL_SIZE)
    out = np.einsum("ij,jkc,lk->ilc", wy, rgb.astype(np.float32), wx)
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)
