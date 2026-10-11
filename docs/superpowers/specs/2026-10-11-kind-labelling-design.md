# Kind labelling design

| Field | Value |
| --- | --- |
| Status | Draft, for review |
| Date | 2026-10-11 |
| Related | [Model contract](../../architecture/00-concepts/model-contract.md), [glossary](../../architecture/12-glossary.md), ADR-009, ADR-013, SUD-02, SUD-07, SUD-08, SUD-10, F-05, R-13, R-14 |
| Issues | [#30](https://github.com/vandemaelefelix/sudoku/issues/30) (label real cells' kind) |

## Goal

Give the real cells a kind label: `printed` or `handwritten`. The kind head then learns from real
cells, not only from synthetic cells. The developer labels groups of similar cells in a local
page. Three checks then find the mistakes that the page did not prevent.

## Background

- None of the 16,277 real cells in `ml/data/cells/` has a kind. `dataset.py` gives every digit
  cell `UNKNOWN_KIND`, and the loss ignores it (`train.py`, `loss`).
- No training example is `handwritten`. The synthetic cells are `printed`, `none` or `notes`.
- A spike on the `7/` folder grouped the cells with k-means on the model's features plus the ink
  colour. With 20 groups, seven groups (about 1,160 cells) were almost all printed. Seven groups
  (about 375 cells) were almost all handwritten. One group of 17 cells was mixed.
- In `7/`, about three in four cells are printed. A fixed default kind is therefore wrong.
- The spike also found about 15 cells in `7/` with a wrong digit label.

## Decisions

| Topic | Decision | Rejected options |
| --- | --- | --- |
| Meaning of the kind | **By look.** `printed`: made by a printer or a screen. `handwritten`: written by a person with a pen or a pencil. Undecidable cells are `unsure` | By meaning (given or entry). It is closer to the app, but a typed player entry in an app screenshot would need the label `handwritten` |
| Scope of the checks | All seven guards in #30. Labels are checked before a model trains on them | Page guards only, checks later. Page only, without a log |
| Page technology | A Python server in `ml/` on the standard library `http.server`. One HTML file with plain JavaScript | Streamlit or Gradio (a new dependency, a rerun on every click). A screen in the Expo app (breaks SUD-07) |
| Source of truth | The log for kinds, the folders for digits | Kind subfolders such as `cells/7/handwritten/` (doubles the folder layout) |
| Grouping features | The model's 64 features, scaled to length 1, plus two ink-colour values at weight 0.5 | Raw pixels. In the spike, these groups followed brightness and blur, not style |
| Start kind of a screen | None. The first key, **P** or **H**, sets the screen. A group with labelled cells starts with its majority kind | A fixed default. An ink-colour guess (fails for black pen) |
| Speed bump on Enter | None. The checks catch skimmed screens | A short delay before Enter works |
| Digit suspects | The Review screen also shows the digit suspects of `just suspects`. It replaces the contact sheets and `relabels.csv` | Keep the contact sheets and the hand-edited CSV next to the page |
| Training gate | No block. The training report and the model card record the label state | Training refuses unchecked labels |

## Consequences of "by look"

- A typed player entry in a scanned app screenshot gets `printed`. The app loads it as a locked
  given. The player fixes it on the correction screen. Paper puzzles are the main case.
- The glossary defines the kind by how the mark was made. "Given" and "Entry" keep their meaning
  in the app. Their link to `printed` and `handwritten` holds for paper.
- The ADR-009 amendment records this rule (see Documentation changes).

## Storage

| File | In git | Holds | Written by |
| --- | --- | --- | --- |
| `ml/datasets/kind-log.jsonl` | Yes | One line per change | The page, append-only |
| `ml/datasets/cells.csv` | Yes, as today | `id,label,kind` | `just dataset-manifest` |
| `ml/datasets/kind-check.jsonl` | Yes | One line per blind check answer | The Check screen, append-only |
| `ml/data/groups.json` | No (git-ignored) | The groups, rebuilt on demand | `just group-cells` |

A line in `kind-log.jsonl`:

```json
{"t": "2026-10-12T09:14:03Z", "session": "20261012-091102", "action": "20261012-091102-7", "cell": "<sha256>", "field": "kind", "old": null, "new": "printed", "screen": "groups"}
```

- `field` is `kind` or `digit`. For `kind`, the values are `printed`, `handwritten`, `unsure` or
  `null`. For `digit`, the values are folder names.
- `screen` is `groups`, `review` or `undo`.
- `action` groups the lines of one save or one move. An undo line has the action
  `undo:<action>` of the line it reverses.
- A confirmation without a change writes a line with `old` equal to `new`. The Review screen uses
  it to know that a cell was reviewed. This holds for `kind` lines and for `digit` lines.

Rules:

1. The current kind of a cell is the `new` value of its last `kind` line.
2. Undo appends lines that reverse the last action of the current session. It never deletes a
   line. A second undo reverses the action before that. There is no redo.
3. A session rollback appends lines that reverse every action of that session, newest first.
   It refuses when a later session changed one of those cells. `just label-rollback <session>`
   runs it.
4. The `kind` column in `cells.csv` is `printed`, `handwritten`, `unsure`, `none` or blank.
   Every cell in `empty/` gets `none`. A digit cell without a `kind` line gets blank.
5. A `kind` line for a cell in `empty/` is an error. `just dataset-manifest` refuses it.
6. `dataset.py` maps `printed` and `handwritten` to their kind index, `none` to `none`, and
   `unsure` and blank to `UNKNOWN_KIND`.
7. The log holds hashes and words only. It holds no image, so it may be in git (SUD-08).

## Grouping

`just group-cells` writes `ml/data/groups.json`. The page reads this file. It never groups cells
itself.

| Topic | Rule |
| --- | --- |
| Cells | The folders `1/` to `9/`. Not `empty/`, not `unlabeled/` |
| Model | The run named by the `MODEL_RUN` argument. The default is the run in `apps/mobile/assets/models/manifest.json` |
| Features | `model.features` on the contract input, scaled to length 1. Plus the ink colour: the mean blue-difference and red-difference of the darkest 10 % of the pixels in rows and columns `[8, 56)`, divided by 64, times 0.5 |
| Groups | k-means per folder, k-means++ start, seed 0, 30 groups |
| Sureness | `d2 − d1`, with `d1` the distance to the own centre and `d2` the distance to the next centre. Small means not sure |
| Order | Least sure first inside each group. Groups in folder order, then by size, largest first |
| Output | The model run, the seed, and per folder the groups with their ordered cell ids and sureness values |

A new model run gives new groups. The labels survive, because the log keys them to the cell id.

## The page

`just label-cells` starts the server on `127.0.0.1` and opens the browser. The server refuses any
other address (SUD-02, SUD-08). It has four screens: Groups, Review, Check and Progress.

A web page in another tab can send requests to `127.0.0.1`. The server therefore accepts a request
only when its `Host` header is `127.0.0.1:<port>` or `localhost:<port>`. It accepts a `POST` only
with `Content-Type: application/json`. A browser sends such a request from another site only
after a preflight, and the server answers no preflight.

### Groups screen

```
 Digit 7 · group 4 of 30 · 38 cells · folder 7/: 612 of 1,570 labelled
 ┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐   ┌──────────┐
 │ 7 H│ 7 P│ 7 P│ 7 ?│ 7 P│ ...                    │   │  large   │
 ├────┼────┼────┼────┼────┼────                    │   │  preview │
 │ ...                                             │   │  of the  │
 └─────────────────────────────────────────────────┘   │  hovered │
  P all printed  H all handwritten  Enter save         │  cell    │
  click switch  ⌥-click unsure  0–9 move  Z undo       └──────────┘
```

- A screen shows one group, at most 50 cells. A larger group takes more screens.
- The page shows the original colour cell image at about 96 px, not the model input.
- Each cell shows a letter (`P`, `H`, `?`) and a colour. The state never depends on colour alone.
- A thick border marks the least sure 10 % of a group.
- The preview shows the hovered cell at about 256 px.
- The page skips groups whose cells all have a kind. The Progress screen can open any group.
- A cell that moved into a folder after `just group-cells` is in no group of that folder. Each
  folder therefore ends with one extra "ungrouped" group that holds these cells.

| Input | Action |
| --- | --- |
| P | Set every cell on the screen to `printed` |
| H | Set every cell on the screen to `handwritten` |
| Click | Switch one cell between `printed` and `handwritten` |
| ⌥-click | Set one cell to `unsure` |
| 0–9 over a cell | Move the cell to that digit folder. 0 means `empty/`. The move happens at once |
| Enter | Save the screen. Open the next screen |
| S | Skip the screen without a save |
| Z | Undo the last action |

- A save writes one `kind` line for each cell on the screen that changed or had no kind. A
  confirmed default counts as a label.
- Enter does nothing while a cell on the screen has no kind.
- A digit move uses `apply_relabels` for one cell. It writes a `digit` line. It then removes the
  cell from the screen. A move to `empty/` also writes a `kind` line with `new` set to `null`.
- Undo works on whole actions. A save is one action. A digit move is one action. Undo of a move
  moves the file back.
- Clicks before Enter live in the browser only. A closed tab loses at most one screen.
- The server handles one write at a time. It flushes each line to disk before it answers.

### Review screen

The Review screen looks like the Groups screen. Each cell also shows its reason and its evidence.
A confirm or a change writes a line with `screen` set to `review`. The cell then leaves the list.
It comes back only when new evidence arrives after that line.

| Reason | Evidence on the cell | Confirm writes | Change |
| --- | --- | --- | --- |
| Near-duplicates | The other members of the near-duplicate group, shown next to it | `kind` line | Click, ⌥-click |
| Kind model | The model's kind and its probability | `kind` line | Click, ⌥-click |
| Digit model | The model's digit and its probability | `digit` line, `old` equal to `new` | 0–9 |
| Check | The blind check answer | `kind` line | Click, ⌥-click |

On the Review screen, Enter confirms every cell on the screen that you did not change.

### Check screen

- The screen draws 200 cells that have `printed` or `handwritten`, with seed 0.
- Half of the cells come from the test split. The split is `split_by_group` with the seed and the
  fractions of the default training config. Wrong test labels distort every metric.
- The screen draws only cells whose last `kind` line is 7 days old or older. If fewer than 200
  qualify, the screen says so and does not start.
- The screen shows no label and no default. The keys are P, H and ⌥-click for `unsure`.
- Each answer is a line in `kind-check.jsonl`. It never changes a label.
- At the end the screen shows the agreement, a confusion table and the disagreements. Each
  disagreement goes to the Review screen.

### Progress screen

Per folder: cells with a kind, `unsure` cells, cells without a kind, digit moves, open Review
items and the last check agreement. Each group links to its Groups screen.

## Checks

| Guard | Where | Rule |
| --- | --- | --- |
| 1. Unusual cells first | Groups screen | Least sure first. A thick border on the least sure 10 % |
| 2. Wrong click or early save | Groups screen | Undo. The append-only log. Session rollback |
| 3. Unclear cell | All screens | `unsure`. Training ignores it |
| 4. Wrong digit | Groups and Review screens | Move with 0–9. The kind stays, because the log keys it to the cell id |
| 5. Near-duplicates disagree | The server, after each save | `group_ids` from `dataset.py`, at most 4 bits apart. A group whose cells have both `printed` and `handwritten` goes to Review. No automatic fix |
| 6. The model disagrees | `just suspects` | The existing 5-fold run ranks the digit and the kind. Digit: the 150 cells with the lowest held-out probability for their label, as today. Kind: each cell with a kind whose held-out kind probability is below 0.10. The run writes `ml/data/review/suspects.csv` with a `field` column. Both go to Review |
| 7. Blind re-label | Check screen | 200 cells, at least 7 days after their label |

For guard 6, `suspects.py` reads the kind from `cells.csv` through `dataset.py`. The fold models
learn the kind from the labelled cells in the other folds. `suspects.py` no longer writes contact
sheets or `relabels.csv`, and no longer needs `refuse_reviewed`. `just relabel` and
`apply_relabels` stay: the page uses `apply_relabels` for each digit move.

## Training report

`train.py` adds four lines to the report and the model card. If the label state cannot be read,
for example because `cells.csv` is out of date, the card says so and the run continues:

- Kind labels: the count of `printed`, `handwritten` and `unsure` real cells.
- Open Review items, at the time of training.
- The last check agreement, with its date and sample size.
- Kind accuracy on the real test cells that have `printed` or `handwritten`, next to the existing
  kind accuracy on synthetic cells.

## Modules

| Module | Job |
| --- | --- |
| `sudoku_ml/kind_log.py` | Read and append the log. Compute the current kinds. Build undo and rollback lines |
| `sudoku_ml/grouping.py` | Features, ink colour, k-means, sureness. Write `groups.json` |
| `sudoku_ml/label_server.py` | The HTTP server and its JSON endpoints. Binds to `127.0.0.1` only |
| `sudoku_ml/label_page.html` | The page: screens, keys, rendering |
| `sudoku_ml/kind_review.py` | Collect Review items from guards 5, 6 and 7 |
| `sudoku_ml/manifest.py` | Add the `kind` column. Refuse a `kind` line for an empty cell |
| `sudoku_ml/dataset.py` | Read the kind from `cells.csv` |
| `sudoku_ml/suspects.py` | Rank the digit and the kind into one `suspects.csv`. Drop the sheets and `relabels.csv` |
| `sudoku_ml/train.py` | Report the label state and the real kind accuracy |
| `justfile` | `group-cells`, `label-cells` |

## Testing

- `kind_log`: current kinds, undo, session rollback, refusal of a line for an empty cell.
- `grouping`: a fixed input gives the same groups. Sureness order. Ink colour of a red, a blue and
  a black synthetic cell.
- `label_server`: every endpoint on a temporary cells folder. The server refuses to bind to
  `0.0.0.0`. A save writes the expected lines. A digit move moves the file and undo moves it back.
- `manifest` and `dataset`: the `kind` column and its mapping to the kind index.
- `kind_review`: one test per guard, with a small synthetic log.
- The page itself gets a manual check: one folder labelled end to end.

## Documentation changes

- ADR-009 amendment: kind labels live in an append-only log in git. `cells.csv` gets the `kind`
  column, computed from the log. The kind means how the mark was made.
- `00-DECISIONS.md` and `09-architecture-decisions.md`: the ADR-009 row.
- `12-glossary.md`: "Kind head" and the kind values by look. New terms: "kind log", "Review
  item", "check agreement", "sureness".
- `model-contract.md`: the label format section names the kind log.
- `11-risks-and-technical-debt.md`: R-13 names the Review screen as the label check.
- `justfile`: the `suspects` comment no longer mentions contact sheets.

## Out of scope

- The `notes` kind. Cells in `empty/` with pencil marks stay `none`.
- EMNIST cells.
- Retraining and promoting the model. That is a separate issue after the labels exist.
- A scan id on cells (R-14).

## Open questions

| Question | Decided by |
| --- | --- |
| Is 30 groups per folder right? The spike used 20 on `7/` | The first folder labelled end to end |
| Is 0.10 the right threshold for guard 6? | The first `just suspects` run with kinds |
