---
status: DRAFT
---

# ADR-032: Hints that teach: four rungs for each step

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-21 |
| Contact | Felix      |

Supersedes point 3 of [ADR-011](adr-011-puzzle-generation-and-hints.md) and the hint bullet of
its v1 amendment. Amends [ADR-012](adr-012-local-persistence.md) and
[ADR-023](adr-023-player-stats.md): the meaning of `hintsUsed`.

## Context

In v1 a hint fills one random cell. The player learns nothing from it. The project has a learning
goal (F-07, quality goal 5). ADR-011 point 3 states the goal: name the area, then the technique,
then the cell. It does not say how the screen does this.

The epic #192 researched the design on 2026-10-21. The design must keep the rules of the project:
the hint code lives in `@sudoku/core` (SUD-04), the game works offline (SUD-01) and nothing leaves
the device (SUD-02). The full behaviour is in the concept [hints](../00-concepts/hints.md).

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Two steps: show the cells and a one-line reason, then fill on a second tap | Teaches. Stays short | Each technique needs its own highlight and text |
| Three steps, as in ADR-011: name the area, then the technique, then the cell | The gentlest | Slow for experienced players |
| A setting that picks between the two | Fits both kinds of player | One more setting |
| **Four rungs (look, technique, why, answer) plus "Show answer"** | The player stops at any rung. "Show answer" reaches the answer in one tap, so no setting is needed | The text of every technique needs four rungs |

## Decision

1. **Four rungs for each step:** look, technique, why and answer.
   - Look: "Look at row 2."
   - Technique: the name and a one-line definition.
   - Why: one or two sentences.
   - Answer: "Put 9 in row 2, column 1."

   "Show answer" jumps to the answer of the last step in one tap.
2. **Candidates come from the givens and the entries.** They never come from the notes. A struck
   candidate shows only on a note that the player wrote.
3. **A wrong entry comes first.** The card says "Erase it first". This hint does not count.
4. **Every hint ends at a placed digit.** An elimination step leads, through at most 6 steps,
   to the single that it unlocks.
5. **The step choice follows how easy a person finds the technique** (Sudoku Explainer order).
   At the same rank, the step nearest the selected cell wins. The choice is deterministic.
6. **The hint card replaces the keypad,** with the same height. The grid does not move. The
   card is not modal. "I'll do it" brings back the keypad. The hint strip then shows between the
   grid and the tools.
7. **A hint counts once.** It counts when it shows the answer, when the player taps "Fill it",
   or when the fallback shows. An answer counts once in a game session. Rungs 1 to 3 are free.
   `hintsUsed` keeps its type. The sync contract does not change.
8. **Hints stay unlimited and free.** The app tracks and sends nothing about them (SUD-02).
9. **Fallback.** When no technique fits, the card says so. It reveals the empty cell with the
   fewest candidates. This is still one cell of the solution, as in ADR-011.
10. **Cell names are plain words:** "row 4, column 9". A box has the name of its place: "the
    top-left box".
11. **Five highlight roles.** Each role is a shape plus a colour: focus unit, pattern cell,
    support digit, struck candidate and target cell.
12. **Techniques.** The tier 1 techniques come first. The tier 2 techniques follow.

    | Tier | Technique | Highlights |
    | --- | --- | --- |
    | 1 | Full house | Focus unit, target cell |
    | 1 | Hidden single | Focus unit, support digit, target cell |
    | 1 | Naked single | Target cell, support digit |
    | 1 | Pointing | Focus unit, pattern cells, struck candidates |
    | 1 | Box-line reduction | Focus unit, pattern cells, struck candidates |
    | 1 | Naked pair and triple | Focus unit, pattern cells, struck candidates |
    | 1 | Hidden pair and triple | Focus unit, pattern cells, struck candidates |
    | 2 | Naked and hidden quad | Focus unit, pattern cells, struck candidates |
    | 2 | X-wing, swordfish | Focus units, pattern cells, struck candidates |
    | 2 | Skyscraper, 2-string kite | Focus units, pattern cells, struck candidates |
    | 2 | XY-wing, XYZ-wing, W-wing | Pattern cells, support digit, struck candidates |

    Tier 3 is not in scope: simple colouring, unique rectangle, BUG+1, jellyfish and chains.
    The jellyfish moved to tier 2 (see the amendment of 2026-10-21 below).
13. **The step contract.** The technique solver returns a `Step` with these fields:
    `technique`, `placements`, `eliminations`, `units`, `pattern`, `support` and `digits`.
    `digits` holds the digits of a pair or a triple. The hint plan and the highlight code read
    only these fields.
14. **An open hint ends in these cases:** the player fills the answer or places the target
    digit, closes the card, taps Undo, pauses, changes the board so that the plan is stale, or
    the game ends. Undo never changes the hints used. A counted answer stays counted. A pause
    ends the hint. The game does not save a hint in progress.
15. **Clean-room code.** The developer reads HoDoKu (GPL) and SudokuWiki for the logic only.
    The code copies nothing from them.

`@sudoku/core` holds the solver and the hint plan (SUD-04). The screen only draws them.

## Consequences

- For a new game, `hintsUsed` means "answers shown". A history row saved before this change keeps
  the old meaning: one cell filled.
- The best time and the flawless win become easier to reach, because rungs 1 to 3 are free.
- The solver must be deterministic, so Vitest can pin the hint of a given board.
- Until the hint card ships, the Hint tool fills the answer of the hint plan at once (amendment 2026-10-22).
- Every technique needs a text for four rungs and a set of highlights. Tier 2 adds code, not design.

## Reassessment Triggers

- Players tap "Show answer" in most hints. Rethink the rungs.
- Players use rungs 1 to 3 to find the answer, and then claim a best time. Count rung 3.
- A hint that needs more than 6 steps is common. Raise the limit or add tier 3 techniques.
- The grading by technique changes the order of the techniques.

## Amendment 2026-10-21: the jellyfish is tier 2

Point 12 lists the jellyfish as tier 3. The solver now has it in tier 2. One fish finder covers the sizes 2
to 4, so the jellyfish costs no extra code. It never fired in 4 000 generated puzzles, so hints rarely meet it.
Tier 3 keeps simple colouring, unique rectangle, BUG+1 and chains (see the amendment below for the solver).

## Amendment 2026-10-21: the solver knows four tier 3 techniques

Point 12 keeps simple colouring, unique rectangle and chains out of scope as tier 3. The solver now finds
simple colouring, unique rectangle type 1, the X-chain and the XY-chain. The hint text for them is not built yet.
Until it is, the hint plan treats them as tier 3. When only a tier 3 technique applies, the plan uses the fallback of point 9.
The card reveals the empty cell with the fewest candidates. Point 4 does not change.

The step contract of point 13 gains two optional fields. `links` holds the cells of a chain in order.
`groups` holds the two colour groups of simple colouring. The unique rectangle is only valid when the puzzle has one solution.
The solver needs the option `unique: true` for it. The hint plan passes `unique: true` for a game puzzle.
A game puzzle always has exactly one solution. Generated puzzles have one. A scanned puzzle has one when it passes the play gate.
BUG+1 stays out of scope.
[ADR-032](../adr/adr-032-hints-that-teach.md) records the decision.

## Amendment 2026-10-22: the hint plan keeps only the steps that the placement needs

Point 4 says that an elimination leads to the single that it unlocks. The step choice of point 5 is greedy.
It can take an elimination that the single does not need. In 30 000 positions of generated puzzles, it often did:
some plans shrank from 6 steps to 2.

1. **The planner prunes.** After the search reaches a placement, the planner tries the plan without each elimination step.
   It drops the step when every later step is still found unchanged.
2. **The cap applies to the pruned plan.** The search may take up to 24 steps. The plan keeps at most 6. A pruned plan of
   more than 6 steps gives the fallback of point 9.
3. **Equal weights form one rank.** Point 5 says "at the same rank". Techniques with the same Sudoku Explainer weight count
   as one rank. Inside it, a placement comes before an elimination, then the step nearest the selected cell. The tier 1
   weights all differ, so this rule acts only when tier 2 gets hint text.
4. **The random hint is gone.** Until the hint card ships, the Hint tool fills the answer of the plan at once. For a wrong
   entry, it selects that cell. The concept [hints](../00-concepts/hints.md) has the details.
