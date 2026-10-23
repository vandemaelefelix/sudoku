---
status: DRAFT
---

# ADR-035: Split the real cells by sudoku page, with a side from a hash of the group

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-23 |
| Contact | Felix      |

## Context

`split_cells` in `ml/src/sudoku_ml/dataset.py` puts the real cells into a train, a validation and a test set.
Training and the Check screen of the labelling app both call it. A group of cells must stay on one side. Before this
ADR, two rules made the groups:

1. Cells whose 64-bit difference hash differs by 4 bits or fewer join one group.
2. The cells of one app scan join one group.

The hash catches copies with almost the same pixels only. On synthetic digit cells, a brightness change of 10 changes
no bit, but camera noise with a sigma of 3 changes 5 bits and a shift of 1 pixel changes 8. Two photos of one page,
or two cells of one photo, never give such copies.

A measure on the dataset of 2026-10-23 (34 218 cells, seed 7, split 80/10/10) showed the leakage:

| Measure | Old split |
| --- | --- |
| Test cells with a photo link | 3 189 of 5 735 |
| Test cells whose photo also has training cells | 3 189 (55.6 % of the test set) |
| Photos with cells in both training and test | 215 |
| Photo pairs that show the same page, with cells on different sides | 6 of 7 |

The cells of one photo share the font, the paper, the light and the camera. A test cell with siblings in training is
easier than a cell of a new photo, so the test accuracy was too high.

A second fault: `split_by_group` shuffled the list of all groups with the seed. One new cell changed the list, so it
moved groups of old cells to other sides. The Check screen then got other test cells after each fetch.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Keep the current groups | The split stays as it is | 55.6 % of the test set leaks. The metrics stay too high |
| **Group by the source photo for every cell that has one** | Simple. Uses the `photo_id` column that exists | The split changes once. Two photos of one page still split |
| **Also join the photos of one page, from their labelled digits** | Closes the leakage between photos. Needs no image work | A rule with two numbers. Works only for linked cells |
| Join the photos of one page with a hash of the flattened grid | Works before the cells have labels | Needs the outline of every photo. Light and angle change the hash |
| A larger `max_distance` for the cell hash | One number to change | Joins different cells: an empty cell differs from another empty cell by few bits |
| **The side of a group from a hash of its key** | New cells never move an old group | The sizes of the sides vary more than with a shuffle |
| Keep the shuffle of all groups | Exact fractions of groups | Every new cell can move every group |

## Decision

1. **Every cell with a source photo carries the key of its page.** `read_real_cells` gives it to the cell, also for an
   imported photo. Before, only the cells of an app scan carried their photo.
2. **Photos of one page share one key.** `page_keys` compares the labelled digit cells of every two photos. Two photos
   show the same page when they share at least 10 digit cells at the same position (`SAME_PAGE_MIN_DIGITS`) and 90 %
   of these hold the same digit (`SAME_PAGE_AGREEMENT`). The key of a page is its smallest photo id.
3. **The cell hash still joins near-copies.** A cell without a source photo keeps only this rule. 16 923 cells of the
   dataset have no photo link, because they were cut before the link existed.
4. **The side of a group comes from a hash.** `side_of` takes the SHA-256 of `<seed>:<key>` and maps it to train,
   validation or test with the fractions of the config. The key of a group is the smallest key of its cells: the page
   key, or else the file name of the cell.
5. **`split_cells` stays the one entry point.** Training, `just suspects` (through `group_ids`) and the Check screen
   use the same groups.

## Consequences

- The test set changes once. On the same data the leakage falls to 0: no test cell has a photo in training, and no
  page has cells on two sides.
- The test accuracy falls to an honest value. On the dataset of 2026-10-23, seed 7: the old split gives
  OLD_ACCURACY, the new split gives NEW_ACCURACY digit accuracy on its test cells.
- The test set is smaller and its size varies with the hash. A photo holds up to 81 cells, so one photo more or less
  in the test set moves its size. On the dataset of 2026-10-23 the test set has 1 884 cells (5.5 %), the validation
  set 2 100 (6.1 %). The confidence interval of the test accuracy is wider.
- A new cell never moves an old group, unless it joins that group and has a smaller key. A new photo of a known page
  with a smaller photo id moves the page. Both are rare.
- The Check screen shows other test cells once. The earlier answers in `kind-checks.jsonl` stay valid as a measure of
  the person, not of the split.
- The suspect ranking folds by page too, so a cell is never judged by a model that saw its siblings.
- The comparison of two photos costs a matrix product over all photos. It takes milliseconds for a few hundred photos.

## Reassessment Triggers

- The test set falls under 1 000 cells, or the accuracy changes by more than its confidence interval from one fetch to
  the next. Then raise the test fraction, or keep a fixed holdout of whole pages.
- The dataset holds more than 10 000 photos. Then measure the time of `page_keys`.
- Most new cells come without a photo link. Then rule 2 does not help, and a grid hash is needed.
- `just promote-model` (ADR-007) gets its own holdout. Then check that the two splits agree on the pages.
