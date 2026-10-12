import json
from pathlib import Path

import numpy as np
import pytest
from photos import grid_photo, save_photo

from sudoku_ml.manifest import pixel_id
from sudoku_ml.photo_import import (
    PhotoPaths,
    import_folder,
    main,
    read_detections,
    read_photos,
    write_photos,
)


def paths_in(root: Path) -> PhotoPaths:
    return PhotoPaths.under(root / "ml")


def test_a_folder_of_photos_is_copied_listed_and_detected(tmp_path: Path):
    folder = tmp_path / "in"
    first = save_photo(grid_photo(seed=1), folder / "a.png")
    save_photo(grid_photo(seed=2), folder / "b.PNG")
    (folder / "notes.txt").write_text("not a photo")
    paths = paths_in(tmp_path)
    counts = import_folder(folder, paths, origin="phone", licence="own")
    assert counts == {"imported": 2, "already": 0, "unreadable": 0, "no_source": 0}
    rows = read_photos(paths.manifest)
    first_id = pixel_id(first)
    assert rows[0] == {
        "id": first_id,
        "file": f"{first_id[:16]}.png",
        "origin": "phone",
        "licence": "own",
        "attribution": "",
    }
    assert (paths.photos / f"{first_id[:16]}.png").read_bytes() == first.read_bytes()
    assert rows[1]["file"].endswith(".png")
    detection = read_detections(paths.detections)[first_id]
    assert detection["reason"] == "full grid" and len(detection["corners"]) == 4
    assert (detection["width"], detection["height"]) == (1000, 800)


def test_importing_the_same_folder_twice_adds_nothing(tmp_path: Path):
    folder = tmp_path / "in"
    save_photo(grid_photo(seed=1), folder / "a.png")
    paths = paths_in(tmp_path)
    import_folder(folder, paths, origin="phone", licence="own")
    counts = import_folder(folder, paths, origin="phone", licence="own")
    assert counts["already"] == 1 and counts["imported"] == 0
    assert len(read_photos(paths.manifest)) == 1
    assert len(list(paths.photos.iterdir())) == 1


def test_the_scraper_manifest_in_the_parent_gives_origin_licence_and_attribution(tmp_path):
    out = tmp_path / "sudoku-paper"
    save_photo(grid_photo(seed=3), out / "handwritten" / "wicht-image7.png")
    line = {
        "file": "wicht-image7.png",
        "source": "openverse/flickr",
        "licence": "by-nc",
        "attribution": "Photo by someone, CC BY-NC",
    }
    (out / "manifest.jsonl").write_text(json.dumps(line) + "\n")
    paths = paths_in(tmp_path)
    import_folder(out / "handwritten", paths, origin=None, licence=None)
    row = read_photos(paths.manifest)[0]
    assert (row["origin"], row["licence"]) == ("openverse", "by-nc")
    assert row["attribution"] == "Photo by someone, CC BY-NC"


def test_a_photo_without_origin_or_licence_is_skipped(tmp_path: Path):
    folder = tmp_path / "in"
    save_photo(grid_photo(seed=1), folder / "a.png")
    paths = paths_in(tmp_path)
    counts = import_folder(folder, paths, origin=None, licence=None)
    assert counts["no_source"] == 1
    assert not paths.photos.exists() or not any(paths.photos.iterdir())


def test_an_unreadable_file_is_counted_and_skipped(tmp_path: Path):
    folder = tmp_path / "in"
    folder.mkdir()
    (folder / "broken.jpg").write_bytes(b"not a jpeg")
    counts = import_folder(folder, paths_in(tmp_path), origin="web", licence="none")
    assert counts["unreadable"] == 1


def test_old_rows_get_licence_none_and_keep_their_order(tmp_path: Path):
    paths = paths_in(tmp_path)
    paths.manifest.parent.mkdir(parents=True)
    paths.manifest.write_text("id,file,origin\nbbb,bbb.jpg,phone\naaa,aaa.jpg,web\n")
    rows = read_photos(paths.manifest)
    assert [r["id"] for r in rows] == ["bbb", "aaa"]
    assert rows[0]["licence"] == "none" and rows[0]["attribution"] == ""
    write_photos(paths.manifest, rows)
    assert paths.manifest.read_text().splitlines()[0] == "id,file,origin,licence,attribution"


def test_a_rotated_photo_gets_upright_corners(tmp_path: Path):
    upright = grid_photo(width=800, height=1000, left=100, top=200, size=540)
    # Orientation 6 means: turn 90° clockwise to show. So store the photo turned the other way.
    stored = np.rot90(upright, k=1).copy()
    path = save_photo(stored, tmp_path / "in" / "turned.png", orientation=6)
    paths = paths_in(tmp_path)
    import_folder(tmp_path / "in", paths, origin="phone", licence="own")
    detection = read_detections(paths.detections)[pixel_id(path)]
    assert (detection["width"], detection["height"]) == (800, 1000)
    expected = [[100, 200], [640, 200], [640, 740], [100, 740]]
    assert np.abs(np.array(detection["corners"]) - expected).max() <= 8


def test_a_heic_photo_is_imported(tmp_path: Path):
    from PIL import Image

    path = tmp_path / "in" / "phone.heic"
    path.parent.mkdir(parents=True)
    try:
        Image.fromarray(grid_photo()).save(path, format="HEIF", quality=95)
    except (KeyError, OSError, ValueError) as error:
        pytest.skip(f"this pillow-heif build cannot write HEIC: {error}")
    paths = paths_in(tmp_path)
    assert import_folder(tmp_path / "in", paths, origin="phone", licence="own")["imported"] == 1
    row = read_photos(paths.manifest)[0]
    assert row["file"].endswith(".heic")
    assert read_detections(paths.detections)[row["id"]]["reason"] == "full grid"


def test_the_cli_refuses_an_unknown_origin(tmp_path: Path):
    with pytest.raises(SystemExit):
        main([str(tmp_path), "--origin", "reddit", "--licence", "none"], tmp_path / "ml")
