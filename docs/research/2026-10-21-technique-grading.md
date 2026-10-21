# Research: grading a puzzle by technique and choice

Date: 2026-10-21. Done for issue #53, with the technique solver of #199, #200 and #201. The
decisions that follow from it are in the amendment "grading by technique" of ADR-011.

Questions:

1. How are generated puzzles spread over the four levels, for several numbers of givens?
2. How is the choice spread for puzzles that need only singles?
3. Which value of `EASY_MIN_CHOICE` fits the data?
4. Does the grade stay the same when the puzzle is transformed? How long does a grade take?
5. What does this mean for the generator (#202)?

Every number in sections 2 to 7 is measured, unless the text says "derived". A derived number
comes from a measured number by a stated calculation.

## 1. Method

The code is in `shared/core/src/grading/`. The grade follows ADR-011 (amendment 2026-10-21).
`TECHNIQUE_LEVEL` in `levels.ts` holds the level of each technique. The weights are the Sudoku
Explainer points of `TECHNIQUE_ORDER`. The grade runs the solver with `GRADE_ORDER`: the ranks of
`TECHNIQUE_ORDER`, sorted by level, with the order of `TECHNIQUE_ORDER` inside a level.

The measurement is `shared/core/src/grading/measure.test.ts`. It does nothing in a normal test
run. This command runs it and prints the tables below:

```sh
MEASURE_GRADES=1 pnpm --filter @sudoku/core exec vitest run src/grading/measure.test.ts --silent=false
```

`MEASURE_PER_SET` and `MEASURE_SYMMETRY_PER_SET` change the sizes. The run takes about 60 s.

| Item | Value |
| --- | --- |
| Sets | 40, 34, 29 and 25 givens from `generateWithTarget(target, seed)`, and one minimal set |
| Minimal set | One removal pass over a random full grid. It runs until no given can go. Mean 24.4 givens |
| Size | 2 000 puzzles per set, seeds 0 to 1 999. 10 000 puzzles in total |
| Grade | `grade()` with `EASY_MIN_CHOICE = 19`. The level shares of the singles-only puzzles depend on this value |
| Machine | A Mac, Node, one thread. The numbers for the iPhone (Hermes) are not measured |

`generateWithTarget(25, seed)` reaches 25 givens for most seeds. Other seeds return the
attempt with the fewest givens. The mean number of givens of the set is 25.0.

### Why the grade has its own order

`TECHNIQUE_ORDER` is the order in which a hint searches. The X-wing (3.2) comes before the hidden
pair (3.4) and the hidden triple (4.0). A solve in that order can use an X-wing although a hidden
pair also solves the puzzle. The puzzle would then grade hard. `GRADE_ORDER` tries every medium
technique before the first hard one. Hints keep `TECHNIQUE_ORDER`.

The effect is small. `measure.test.ts` grades every puzzle with `TECHNIQUE_ORDER` and compares the
result with the grade. The table counts the puzzles that both orders solve. It then counts those
where the hint order finds a hardest technique of a higher level. It also counts the puzzles that
only one of the two orders solves.

| set | both solve | hint order finds a higher hardest level | hint order solves, grade order is `beyond` | grade order solves, hint order is `beyond` |
| --- | --- | --- | --- | --- |
| 40 givens | 2000 | 0 | 0 | 0 |
| 34 givens | 1999 | 0 | 0 | 0 |
| 29 givens | 1954 | 1 | 0 | 0 |
| 25 givens | 1810 | 3 | 0 | 0 |
| minimal | 1722 | 6 | 0 | 0 |

The hint order finds a harder level in 10 of 7 485 puzzles. Both orders solve the same puzzles.

## 2. Level shares

Share of the puzzles of a set, in percent. `beyond` means the solver does not finish the puzzle.

| set | puzzles | mean givens | easy | medium | hard | expert | beyond |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 40 givens | 2000 | 40.0 | 53.0 | 46.8 | 0.1 | 0.0 | 0.0 |
| 34 givens | 2000 | 34.0 | 6.2 | 91.3 | 2.1 | 0.4 | 0.1 |
| 29 givens | 2000 | 29.0 | 0.0 | 85.8 | 8.6 | 3.3 | 2.3 |
| 25 givens | 2000 | 25.0 | 0.0 | 68.3 | 14.9 | 7.3 | 9.5 |
| minimal | 2000 | 24.4 | 0.0 | 60.4 | 16.7 | 9.1 | 13.9 |

Findings:

- A puzzle with 40 givens needs only singles. A puzzle with 25 givens needs a harder technique
  than a single in 47 % of the cases, and the solver does not finish 9.5 % of them. The givens
  count moves the levels, as expected.
- The medium column holds many puzzles that need only singles. The choice rule makes them
  medium. Pointing is the hardest technique of 8.7 % of the 25-givens set. The box-line
  reduction adds 2.9 %. The pairs and triples add 7.2 %.
- `beyond` is 9.5 % at 25 givens and 13.9 % for minimal puzzles. The solver has no forcing
  chains, ALS and similar. The generator (#202) rejects a puzzle that is `beyond`.
- The hardest technique of a puzzle that needs only singles is the hidden single or the naked
  single. The naked single weighs more (2.3 against 1.2 or 1.5), so a puzzle with one naked
  single and many hidden singles has the naked single as its hardest technique.

Hardest technique, per set, in percent of the puzzles. The lists include the `beyond` puzzles, so
they do not sum to the level shares above.

- 40 givens: hiddenSingle 99.6, nakedSingle 0.3, skyscraper 0.1, xyWing 0.1
- 34 givens: hiddenSingle 94.7, nakedSingle 1.9, skyscraper 1.3, pointing 0.7, xyWing 0.5, xyChain 0.3, nakedPair 0.1, xyzWing 0.1, wWing 0.1, boxLine 0.1, xChain 0.1
- 29 givens: hiddenSingle 67.8, nakedSingle 11.6, skyscraper 3.9, pointing 3.8, xyChain 3.1, xyWing 2.9, nakedPair 1.5, wWing 1.4, boxLine 1.3, xyzWing 0.8, xChain 0.7, twoStringKite 0.3, hiddenPair 0.3, uniqueRectangle 0.3, xWing 0.3, simpleColouring 0.1, nakedTriple 0.1
- 25 givens: hiddenSingle 34.0, nakedSingle 18.8, pointing 8.7, xyChain 7.2, skyscraper 6.2, xyWing 5.5, nakedPair 4.0, wWing 3.4, boxLine 2.9, hiddenPair 2.6, twoStringKite 1.9, xyzWing 1.6, uniqueRectangle 1.2, xChain 1.1, nakedTriple 0.3, simpleColouring 0.3, hiddenTriple 0.3, xWing 0.2
- minimal: hiddenSingle 24.0, nakedSingle 17.4, pointing 10.3, xyChain 9.3, skyscraper 6.8, xyWing 6.2, nakedPair 5.2, boxLine 3.5, wWing 3.5, hiddenPair 3.3, twoStringKite 3.0, xyzWing 2.3, xChain 2.0, uniqueRectangle 1.4, nakedTriple 0.5, simpleColouring 0.5, hiddenTriple 0.3, xWing 0.3, swordfish 0.1, nakedQuad 0.1

## 3. Choice of the puzzles that need only singles

The choice counts in rounds. A round fills every cell that a single can fill, all at once. It
counts one move per cell, and each move has the number of cells of its round as its value. When
no single applies, the round applies the first other step of the solver and counts one move with
the value 0. The choice is the mean value of the first 25 moves. The table counts the puzzles
whose hardest technique is a single.

| set | puzzles | p10 | p25 | p50 | p75 | p90 |
| --- | --- | --- | --- | --- | --- | --- |
| 40 givens | 1997 | 13.84 | 16.32 | 19.24 | 22.44 | 26.00 |
| 34 givens | 1932 | 8.72 | 10.72 | 13.12 | 15.64 | 18.04 |
| 29 givens | 1588 | 5.56 | 6.72 | 8.32 | 10.28 | 12.04 |
| 25 givens | 1054 | 4.12 | 4.92 | 6.04 | 7.32 | 8.60 |
| minimal | 828 | 3.72 | 4.44 | 5.44 | 6.52 | 7.60 |

The choice grows with the number of givens. A puzzle with 40 givens has about 19 cells open at
each move. A minimal puzzle has about 5. A minimal puzzle that needs only singles is a puzzle
where the next cell is hard to find. This is the reason for the choice rule.

A path-based choice, one single at a time, does not work. The solver takes the first single in
scan order, so a transform changes the path and the level flips for some pairs. The rounds do not
depend on the scan order (section 7).

## 4. The threshold `EASY_MIN_CHOICE`

Aim of the issue: easy is a puzzle that needs only singles and has many open cells at each
step. The aim of the plan: easy keeps about the top half of the singles-only puzzles with 40
givens. Most singles-only minimal puzzles become medium.

The table shows the share of each set that grades easy for a threshold T. The other singles-only
puzzles of the set grade medium.

| T | 40 givens | 34 givens | 29 givens | 25 givens | minimal |
| --- | --- | --- | --- | --- | --- |
| 6 | 99.8 | 95.8 | 67.4 | 27.4 | 15.5 |
| 8 | 99.5 | 90.9 | 44.1 | 8.3 | 3.3 |
| 10 | 99.0 | 77.9 | 22.4 | 2.1 | 0.3 |
| 12 | 96.5 | 60.0 | 8.1 | 0.5 | 0.0 |
| 14 | 89.4 | 39.6 | 2.6 | 0.0 | 0.0 |
| 16 | 77.4 | 21.6 | 0.6 | 0.0 | 0.0 |
| 17 | 70.2 | 14.3 | 0.3 | 0.0 | 0.0 |
| 18 | 62.5 | 10.1 | 0.1 | 0.0 | 0.0 |
| **19** | **53.0** | **6.2** | **0.0** | **0.0** | **0.0** |
| 20 | 44.0 | 3.5 | 0.0 | 0.0 | 0.0 |
| 21 | 36.2 | 1.8 | 0.0 | 0.0 | 0.0 |
| 22 | 30.3 | 1.3 | 0.0 | 0.0 | 0.0 |
| 24 | 16.6 | 0.3 | 0.0 | 0.0 | 0.0 |

Choice: `EASY_MIN_CHOICE = 19`.

- At 19, 53 % of the 40-givens puzzles are easy. The median choice of this set is 19.2, so 19
  keeps the top half.
- At T = 10, 99 % of the minimal singles-only puzzles are medium. At T = 8 it is 92 %. Derived:
  the singles-only minimal puzzles are 828 of 2 000, that is 41.4 % of the set. The easy share
  of the set divided by 41.4 % is the easy share of those puzzles: 3.3 / 41.4 = 8 % at T = 8,
  and 0.3 / 41.4 = 0.7 % at T = 10. So the first T of the table with more than 95 % medium is
  10. At 19 all of them are medium.
- Easy puzzles come from about 40 givens and more. At 34 givens only 6 % are easy. This is
  close to the v1 rule (easy is 40 givens). Medium then holds the singles-only puzzles from
  about 34 to 25 givens, and the puzzles that need pointing, box-line reduction or a subset.
- The cost: a medium puzzle is often "singles only, with 5 to 18 open cells". A player who
  expects pointing pairs in medium does not meet them in most medium puzzles. A lower
  threshold, 14, gives 89 % easy at 40 givens and 40 % at 34 givens. This is the other end of
  the range. The research on solve time does not fix the value. Only a test with players does.
  Change the value when the app records real solve times per level.

## 5. Scores

The score is the sum of the step weights, in Sudoku Explainer points. Percentiles per level of
the grade (p10, p50, p90, maximum). Level `easy` and `medium` overlap, since the choice moves a
singles-only puzzle.

| set | level | puzzles | p10 | p50 | p90 | max |
| --- | --- | --- | --- | --- | --- | --- |
| 40 givens | easy | 1061 | 45 | 45 | 45.3 | 45.6 |
| 40 givens | medium | 936 | 45 | 45.2 | 45.4 | 46.9 |
| 40 givens | hard | 3 | 51.8 | 52.2 | 52.6 | 52.6 |
| 34 givens | easy | 123 | 52.2 | 52.4 | 52.6 | 53.3 |
| 34 givens | medium | 1826 | 52.2 | 52.4 | 53 | 69.3 |
| 34 givens | hard | 42 | 57.1 | 62.7 | 71.5 | 78.6 |
| 34 givens | expert | 8 | 59.9 | 76.6 | 85 | 85 |
| 34 givens | beyond | 1 | 18.2 | 18.2 | 18.2 | 18.2 |
| 29 givens | medium | 1717 | 58.4 | 59.1 | 61.9 | 93.4 |
| 29 givens | hard | 171 | 65 | 73.9 | 87.7 | 111.8 |
| 29 givens | expert | 66 | 74.6 | 88.6 | 107.4 | 126.5 |
| 29 givens | beyond | 46 | 21.1 | 32.8 | 49.8 | 60.9 |
| 25 givens | medium | 1367 | 63.6 | 65.3 | 76.1 | 98.9 |
| 25 givens | hard | 298 | 72.6 | 84 | 100.2 | 121.8 |
| 25 givens | expert | 145 | 84.2 | 99 | 126.1 | 167.3 |
| 25 givens | beyond | 190 | 22.5 | 33.8 | 52.3 | 84.7 |
| minimal | medium | 1207 | 64.1 | 67.4 | 79.5 | 104.2 |
| minimal | hard | 334 | 73.5 | 85.1 | 102.2 | 119.6 |
| minimal | expert | 181 | 86.3 | 100 | 125.3 | 168.5 |
| minimal | beyond | 278 | 22.4 | 35.1 | 55.3 | 83.3 |

The singles-only scores are 45 to 70. Each added step of pointing adds 2.6 and the steps around
it. Hard and expert puzzles reach 60 to 170. The scores do not set a level. Stars inside a level are
not part of this work. They can use the score later.

## 6. Time

Grade time and generation time in milliseconds, on a Mac. A grade runs the solver once and then
the choice.

| set | grade median | grade p99 | grade max | generate median | generate p99 |
| --- | --- | --- | --- | --- | --- |
| 40 givens | 0.46 | 0.9 | 4.4 | 0.33 | 0.5 |
| 34 givens | 0.49 | 1.3 | 3.4 | 0.47 | 0.7 |
| 29 givens | 0.54 | 4.1 | 7.7 | 0.79 | 2.4 |
| 25 givens | 0.68 | 5.2 | 10.2 | 2.38 | 17.3 |
| minimal | 0.82 | 6.3 | 10.4 | 3.81 | 25.4 |

The slowest grade of 10 000 puzzles takes 10.4 ms. This is far below the 2 s of QR-12, even if
the iPhone is 10 times slower (derived: about 100 ms). The Vitest in `grade.test.ts` fails when
the slowest of 100 grades takes 100 ms or more. On the Mac it takes 3 ms.

## 7. Symmetry

The test transforms each puzzle in one way: relabel the digits, swap rows in a band, swap
columns in a stack, swap bands, swap stacks or transpose. A last row applies all six. 5 000
pairs per transform (1 000 puzzles from each of the five sets):

| transform | pairs | level differs | hardest level differs | hardest technique differs | level changes | choice shift median / p99 | singles-only choice differs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| relabel | 5000 | 0 | 0 | 0 | none | 0.00 / 0.00 | 0 |
| rows-in-band | 5000 | 0 | 0 | 0 | none | 0.00 / 0.00 | 0 |
| columns-in-stack | 5000 | 0 | 0 | 0 | none | 0.00 / 0.00 | 0 |
| bands | 5000 | 0 | 0 | 0 | none | 0.00 / 0.24 | 0 |
| stacks | 5000 | 0 | 0 | 0 | none | 0.00 / 0.08 | 0 |
| transpose | 5000 | 0 | 0 | 0 | none | 0.00 / 0.24 | 0 |
| all | 5000 | 0 | 0 | 0 | none | 0.00 / 0.32 | 0 |

Findings:

- The level never changed in 35 000 pairs. The hardest technique and its level never changed.
- The choice of a puzzle that needs only singles never changed. A round fills every single cell
  at once, so the rounds and their sizes do not depend on the scan order.
- The choice of a puzzle with a step that is not a single can shift, by 0.32 at p99. Those
  steps follow the scan order. This did not change the level in the measurement. The solver path
  depends on the scan order, so this is empirical. The choice sets the level only when the
  hardest technique is a single, and the hardest technique never changed.
- The Vitest asserts this for 240 puzzles (60 for each givens target) and all seven transforms.
  It asserts that the level and the level of the hardest technique stay the same. It asserts that
  the choice of a puzzle that needs only singles stays the same. At least 5 of the puzzles have a
  singles-only choice within 3 of the threshold, so the test covers the border.

## 8. What this means for the generator (#202)

The yield is the share of the attempts that give a level. An attempt is one call of
`generateWithTarget(target, seed)` and one grade. The attempts and the expected time are derived:
attempts = 1 / yield. Expected time = the mean time of one attempt (generation and grade, on a
Mac) divided by the yield. The yield is measured.

| Target | Level | Yield % | Attempts | Expected time (ms) |
| --- | --- | --- | --- | --- |
| 40 givens | easy | 53.0 | 1.9 | 1.7 |
| 40 givens | medium | 46.8 | 2.1 | 1.9 |
| 40 givens | hard | 0.1 | 666.7 | 587.0 |
| 34 givens | easy | 6.2 | 16.3 | 17.7 |
| 34 givens | medium | 91.3 | 1.1 | 1.2 |
| 34 givens | hard | 2.1 | 47.6 | 51.7 |
| 34 givens | expert | 0.4 | 250.0 | 271.5 |
| 29 givens | medium | 85.8 | 1.2 | 2.0 |
| 29 givens | hard | 8.6 | 11.7 | 19.8 |
| 29 givens | expert | 3.3 | 30.3 | 51.3 |
| 25 givens | medium | 68.3 | 1.5 | 6.8 |
| 25 givens | hard | 14.9 | 6.7 | 31.3 |
| 25 givens | expert | 7.3 | 13.8 | 64.4 |
| minimal | medium | 60.4 | 1.7 | 10.7 |
| minimal | hard | 16.7 | 6.0 | 38.8 |
| minimal | expert | 9.1 | 11.0 | 71.5 |

The table leaves out the rows with a yield of 0 %. A hard puzzle at 40 givens has a yield of 0.1 %.

- Easy: aim at 40 givens. It needs about 2 attempts and 2 ms. Easy at 34 givens needs 16
  attempts.
- Medium: aim at 34 or 29 givens. It needs 1 or 2 attempts.
- Hard: aim at 25 givens, or at minimal puzzles. It needs 6 to 7 attempts and 30 to 40 ms.
- Expert: aim at 25 givens, or at minimal puzzles. It needs 11 to 14 attempts and 60 to 75 ms.
  The `beyond` puzzles (14 % of the minimal puzzles) are rejected, and are part of the attempts
  above.
- The expected times are far below the 2 s of QR-12. The worst case is the p99 of the number of
  attempts. Derived, with independent attempts: p99 attempts = ln 0.01 / ln (1 - yield). For hard
  at 25 givens this is 29 attempts, about 130 ms. For expert at 25 givens it is 61 attempts,
  about 280 ms. For expert on minimal puzzles it is 49 attempts, about 320 ms. These are Mac
  numbers. The pool of ADR-011 point 4 is not needed on these numbers if the iPhone is within 5
  times of the Mac. #202 measures on the iPhone and proposes an issue if the pool must return.
- The generator must reject a puzzle that is `beyond`. It must also reject a puzzle of
  another level than the one it looks for.
- The grade needs a puzzle with exactly one solution. `generateWithTarget` gives that.
