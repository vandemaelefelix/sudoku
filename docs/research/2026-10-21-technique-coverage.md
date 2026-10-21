# Research: the tier 1 techniques, their ratings and their coverage

Date: 2026-10-21. Done for the technique solver in `shared/core/src/technique/`. The numbers come from
`just technique-coverage`. The decisions that follow from this record are in the epic "hints that
teach" and in ADR-032.

Two questions:

1. How difficult is each tier 1 technique, and in which order does a person find them?
2. How many generated puzzles do the tier 1 techniques solve to the end?

## 1. Ratings and order

The order is the order of Sudoku Explainer. The technique solver takes the ratings from this table
into `TECHNIQUE_ORDER`. A test checks that the ratings never decrease down the table.

| Rank | Technique | Rating | Source | Confidence |
| --- | --- | --- | --- | --- |
| 1 | Full house | 1.0 | SukakuExplainer, `HiddenSingleHint`: the rating of a hidden single that is alone in its unit | Medium. I read "alone" as "the only empty cell of the unit" |
| 2 | Hidden single in a box | 1.2 | SukakuExplainer, `HiddenSingleHint` | High |
| 3 | Hidden single in a row or column | 1.5 | SukakuExplainer, `HiddenSingleHint` | High |
| 4 | Naked single | 2.3 | SukakuExplainer, `NakedSingleHint`, the original rating | High |
| 5 | Pointing | 2.6 | SukakuExplainer, `LockingHint` | High |
| 6 | Box-line reduction (claiming) | 2.8 | SukakuExplainer, `LockingHint` | High |
| 7 | Naked pair | 3.0 | SukakuExplainer, `NakedSetHint` | High |
| 8 | Hidden pair | 3.4 | SukakuExplainer, `HiddenSetHint`, the original rating | High |
| 9 | Naked triple | 3.6 | SukakuExplainer, `NakedSetHint` | High |
| 10 | Hidden triple | 4.0 | SukakuExplainer, `HiddenSetHint`, the original rating | High |

- The epic research note gave the same numbers from memory. This check agrees with all of them.
- SukakuExplainer is a fork of Sudoku Explainer. It adds an optional "revised rating": naked single 1.6,
  hidden pair 2.9, hidden triple 3.8. The solver uses the original ratings, so the order stays the
  order of Sudoku Explainer.
- The weights are the Sudoku Explainer ratings.
- The SukakuExplainer README and the HoDoKu pages that I fetched have no per-technique ratings. So I
  read the rating numbers in the `getDifficulty` methods of five SukakuExplainer hint classes. That is
  source code, and I read only those numbers.
- I read no code for its logic. I copied no code. A rating number is a fact, not code.
- The finders follow the technique definitions, not any code.

## 2. Coverage

Setup:

- `generate(level, seed)` for the seeds 1 to 1 000 of each level. The levels are the givens targets of ADR-011.
- Each puzzle is solved with the tier 1 techniques only, easiest first. At each position the first of the
  next steps is applied. Struck candidates stay struck.
- A puzzle is "stuck" when no tier 1 step applies and the grid is not full.
- The run takes about 7 s on a Mac.

| Level | Puzzles | Solved to the end | Stuck | Steps for a solved puzzle (mean, largest) | Empty cells left when stuck (mean) |
| --- | --- | --- | --- | --- | --- |
| easy | 1000 | 99.7 % | 3 | 41.0, 41 | 16.0 |
| medium | 1000 | 97.3 % | 27 | 47.0, 52 | 21.3 |
| hard | 1000 | 85.4 % | 146 | 52.2, 60 | 29.9 |
| expert | 1000 | 67.9 % | 321 | 56.7, 66 | 35.0 |

The next table splits the solved puzzles by the hardest rating that the solve needs. The groups add up.
A puzzle in a group needs the techniques of the earlier groups too.

| Level | Singles only | And pointing or box-line | And pairs | And triples (all of tier 1) | Stuck |
| --- | --- | --- | --- | --- | --- |
| easy | 99.7 % | 0.0 % | 0.0 % | 0.0 % | 0.3 % |
| medium | 96.2 % | 0.9 % | 0.2 % | 0.0 % | 2.7 % |
| hard | 78.9 % | 4.7 % | 1.8 % | 0.0 % | 14.6 % |
| expert | 53.2 % | 9.9 % | 4.5 % | 0.3 % | 32.1 % |

What this shows:

- Singles alone solve 99.7 % of easy and 96.2 % of medium puzzles.
- A third of the expert puzzles and one in seven hard puzzles need a technique of tier 2 or later. The hint
  falls back to the cell with the fewest candidates for them, until tier 2 exists (epic decision 9).
- Pointing, box-line and pairs add few puzzles: 6.5 % on hard and 14.4 % on expert.
- Triples solve 0.3 % of the expert puzzles and no other level. The epic research note guessed 50 to 70 %
  for tier 1 on expert puzzles. The measure is 67.9 %, at the top of that range.
- The stuck puzzles have 16 to 35 empty cells left on average. This record does not say which technique
  solves them.

## 3. Sources

- HoDoKu (GPL-3.0) and SudokuWiki: the technique definitions, as the research note of the epic gives them. I read no code of either, and copied none.
- SukakuExplainer (LGPL-2.1), the `getDifficulty` methods of five hint classes: only the rating numbers of section 1. I read no logic and copied no code.
- The research note of the epic "hints that teach": the first list of techniques and tiers.
- The golden positions of the tests are generated puzzles, played with the tier 1 steps. They are not grids
  from HoDoKu or SudokuWiki.
- I checked each golden step by hand against the definition of its technique.
- A one-off Python program, written from the definitions, also checked each step against the unique
  solution and looked for an easier technique in each position. The repository does not keep this program.
- I did NOT load the golden positions into the SudokuWiki solver or into HoDoKu. Both are interactive
  tools, and no tool in this environment could drive them. A reviewer can do this check by hand.
