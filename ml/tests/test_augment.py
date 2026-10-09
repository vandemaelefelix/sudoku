import torch

from sudoku_ml.augment import augment


def batch() -> torch.Tensor:
    torch.manual_seed(0)
    return torch.rand(8, 3, 64, 64) * 255


def test_keeps_shape_and_range():
    out = augment(batch(), torch.Generator().manual_seed(1))
    assert out.shape == (8, 3, 64, 64)
    assert out.min() >= 0 and out.max() <= 255


def test_changes_the_images():
    x = batch()
    assert (augment(x, torch.Generator().manual_seed(1)) - x).abs().mean() > 1


def test_is_deterministic_per_seed():
    x = batch()
    a = augment(x, torch.Generator().manual_seed(2))
    b = augment(x, torch.Generator().manual_seed(2))
    assert torch.equal(a, b)


def test_zero_strength_is_identity():
    x = batch()
    assert torch.allclose(augment(x, torch.Generator().manual_seed(3), strength=0.0), x, atol=1e-3)
