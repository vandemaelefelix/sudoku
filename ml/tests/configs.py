"""The training config of the smoke run."""

import json
import tomllib
from pathlib import Path

ML = Path(__file__).parents[1]


def smoke_config(tmp_path: Path, **changes) -> Path:
    values = tomllib.loads((ML / "configs" / "smoke.toml").read_text()) | changes
    path = tmp_path / "config.toml"
    path.write_text("\n".join(f"{k} = {json.dumps(v)}" for k, v in values.items()))
    return path
