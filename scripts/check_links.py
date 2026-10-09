#!/usr/bin/env python3
"""Fail if a relative Markdown link points to a file that does not exist."""

import re
import sys
from pathlib import Path

LINK = re.compile(r"\]\(([^)#\s]+)(#[^)]*)?\)")
FENCE = re.compile(r"^(```|~~~).*?^\1", re.MULTILINE | re.DOTALL)
INLINE_CODE = re.compile(r"`[^`\n]*`")


def broken_links(paths: list[Path]) -> list[str]:
    files: list[Path] = []
    for path in paths:
        files.extend(path.rglob("*.md") if path.is_dir() else [path])
    broken = []
    for file in files:
        text = INLINE_CODE.sub("", FENCE.sub("", file.read_text(encoding="utf-8")))
        for match in LINK.finditer(text):
            target = match.group(1)
            if target.startswith(("http://", "https://", "mailto:")):
                continue
            if not (file.parent / target).resolve().exists():
                broken.append(f"{file}: {target}")
    return broken


if __name__ == "__main__":
    problems = broken_links([Path(arg) for arg in sys.argv[1:]])
    for problem in problems:
        print(problem)
    print(f"{len(problems)} broken link(s)")
    sys.exit(1 if problems else 0)
