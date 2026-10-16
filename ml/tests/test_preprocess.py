import cv2
import numpy as np
import pytest
import torch

from sudoku_ml.preprocess import area_weights, preprocess_batch, preprocess_cell, to_cell_image


def cell(value) -> np.ndarray:
    return np.full((64, 64, 3), value, dtype=np.uint8)


def random_cell(seed: int) -> np.ndarray:
    return np.random.default_rng(seed).integers(0, 256, (64, 64, 3), dtype=np.uint8)


def test_area_weights_rows_sum_to_one():
    w = area_weights(52, 32)
    assert w.shape == (32, 52)
    assert np.allclose(w.sum(axis=1), 1.0, atol=1e-6)


def test_output_shape_and_type():
    out = preprocess_cell(cell(255))
    assert (out.shape, out.dtype) == ((32, 32), np.float32)


def test_white_is_zero_and_black_is_one():
    assert preprocess_cell(cell(255)).max() == pytest.approx(0.0, abs=1e-6)
    assert preprocess_cell(cell(0)).min() == pytest.approx(1.0, abs=1e-6)


def test_grayscale_uses_bt601_in_float():
    assert preprocess_cell(cell((255, 0, 0)))[0, 0] == pytest.approx(1 - 0.299, abs=1e-6)


def test_the_whole_cell_is_read_including_the_border():
    image = cell(255)
    image[:2] = 0
    assert preprocess_cell(image)[0].min() == pytest.approx(1.0, abs=1e-6)


def test_no_per_cell_normalisation():
    assert preprocess_cell(cell(128)).max() == pytest.approx(1 - 128 / 255, abs=1e-6)


def test_matches_opencv_inter_area():
    image = random_cell(1)
    gray = image.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    ref = cv2.resize(np.ascontiguousarray(gray), (32, 32), interpolation=cv2.INTER_AREA)
    assert np.abs(preprocess_cell(image) - (1 - ref / 255)).max() < 1e-5


def test_torch_batch_matches_numpy():
    images = np.stack([random_cell(s) for s in range(4)])
    batch = torch.from_numpy(images).permute(0, 3, 1, 2).float()
    out = preprocess_batch(batch)
    assert tuple(out.shape) == (4, 1, 32, 32)
    expected = np.stack([preprocess_cell(i) for i in images])
    assert np.abs(out[:, 0].numpy() - expected).max() < 1e-5


def test_rejects_wrong_shape():
    with pytest.raises(ValueError):
        preprocess_cell(np.zeros((71, 71, 3), dtype=np.uint8))


def test_to_cell_image_resizes_71_pixel_cells():
    out = to_cell_image(np.full((71, 71, 3), 77, dtype=np.uint8))
    assert (out.shape, out.dtype, int(out[30, 30, 0])) == ((64, 64, 3), np.uint8, 77)


def test_to_cell_image_matches_the_area_average():
    img = np.random.default_rng(7).integers(0, 256, (71, 90, 3), dtype=np.uint8)
    expected = np.clip(
        np.rint(
            np.einsum(
                "ij,jkc,lk->ilc", area_weights(71, 64), img.astype(np.float32), area_weights(90, 64)
            )
        ),
        0,
        255,
    ).astype(np.uint8)
    diff = np.abs(to_cell_image(img).astype(int) - expected.astype(int))
    assert diff.max() <= 1
