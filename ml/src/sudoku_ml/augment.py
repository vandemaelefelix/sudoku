"""Random distortions of 64 × 64 cell images, before preprocessing (research record §3)."""

import math

import torch
import torch.nn.functional as F

_BLUR = torch.tensor([1.0, 2.0, 1.0])
_BLUR = (_BLUR[:, None] * _BLUR[None, :] / 16).expand(3, 1, 3, 3).contiguous()


def augment(
    images: torch.Tensor, generator: torch.Generator, strength: float = 1.0
) -> torch.Tensor:
    """Shift ±4 px, rotate ±6°, scale ±10 %, shear, blur 40 %, gamma, contrast,
    brightness, noise."""
    b, device = images.shape[0], images.device

    def uniform(lo: float, hi: float) -> torch.Tensor:
        return (torch.rand(b, generator=generator) * (hi - lo) + lo).to(device) * strength

    angle = uniform(-6, 6) * math.pi / 180
    scale = 1 + uniform(-0.1, 0.1)
    shear = uniform(-0.1, 0.1)
    shift_x, shift_y = uniform(-4, 4) / 32, uniform(-4, 4) / 32
    cos, sin = torch.cos(angle) / scale, torch.sin(angle) / scale
    theta = torch.stack(
        [
            torch.stack([cos, -sin + shear, shift_x], 1),
            torch.stack([sin, cos, shift_y], 1),
        ],
        1,
    )
    grid = F.affine_grid(theta, list(images.shape), align_corners=False)
    out = F.grid_sample(images, grid, mode="bilinear", padding_mode="border", align_corners=False)

    blurred = F.conv2d(F.pad(out, (1, 1, 1, 1), mode="replicate"), _BLUR.to(device), groups=3)
    blur = (torch.rand(b, generator=generator) < 0.4 * strength).to(device)[:, None, None, None]
    out = torch.where(blur, blurred, out)

    gamma = torch.exp(uniform(-0.35, 0.35))[:, None, None, None]
    out = 255 * (out / 255).clamp(0, 1) ** gamma
    contrast = (1 + uniform(-0.3, 0.3))[:, None, None, None]
    brightness = uniform(-20, 20)[:, None, None, None]
    out = (out - 128) * contrast + 128 + brightness
    sigma = uniform(0, 6)[:, None, None, None]
    noise = torch.randn(images.shape, generator=generator).to(device)
    return (out + noise * sigma).clamp(0, 255)
