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
- The v1 random hint stays until the hint card ships.
- Every technique needs a text for four rungs and a set of highlights. Tier 2 adds code, not design.

## Reassessment Triggers

- Players tap "Show answer" in most hints. Rethink the rungs.
- Players use rungs 1 to 3 to find the answer, and then claim a best time. Count rung 3.
- A hint that needs more than 6 steps is common. Raise the limit or add tier 3 techniques.
- The grading by technique changes the order of the techniques.
