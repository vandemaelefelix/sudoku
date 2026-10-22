---
status: ACCEPTED
---

# ADR-031: A display grid takes its fill colours from the theme hook

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Accepted   |
| Date    | 2026-10-21 |
| Contact | Felix      |

Amends [ADR-015](adr-015-theming.md): the consequence "A theme switch does not re-render the grid" now holds for the
game grid only.

## Context

The assist preview in Settings is a display grid. Each cell has a fill layer that crossfades when an assist changes.

After Settings opens a second time, a theme switch leaves the fills of the preview in the old theme. The digits and
the grid lines change. The diagnostics of Unistyles 3.5.2 (`verify()`) show the cause. The shadow tree keeps the old
`backgroundColor` on every fill view, so the native update of Unistyles does not reach them. The update reaches every
other view of the app. The bug is inside Unistyles. Its exact cause is not known. Unistyles issue 1317 describes a
close relative: a view that mounts after a theme change gets the styles of the old theme.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Fade the fills with an animated style, not `entering` and `exiting` | No hook in the cells | Tested on the iPhone: the fills still keep the old theme |
| Mount the preview grid again on each theme switch | Every fill is correct. The switch hides under the picture of the cell wave | Tested on the iPhone: the new theme renders about 640 ms after the switch, not about 85 ms. The cell wave waits for that render (ADR-025) |
| Upgrade to Unistyles 3.5.3 | No workaround in the app | The release notes name no fix for this bug. It needs a new development build to test |
| **The fills of a display grid read their colours with `useUnistyles()`** | Every fill is correct. A switch renders 81 small fill components again, about 50 ms more | A display cell renders again on a theme switch |

## Decision

1. **A display grid takes its fill colours from `useUnistyles()`.** The fill layers of a display cell get plain
   colour values from `displayFill`, not the fill keys of the cell styles. The values are the same tokens.
2. **The game grid does not change.** An interactive cell reads no theme hook. A theme switch does not render
   it again. The cell styles of Unistyles update it.

## Consequences

- The preview shows the new theme after every switch, also after Settings opens again.
- A theme switch renders the fill layers of the preview again. The new theme renders about 135 ms after the switch.
- `displayFill` in `cell.utils.ts` and the fill keys in `Cell.styles.ts` must give the same colours.

## Reassessment Triggers

- A Unistyles release fixes the stale styles. Then the fill layers can use the cell styles again.
- A display grid shows on a screen where 81 renders on a theme switch are too slow.

## Amendment 2026-10-22: accepted

The code on `develop` proves this decision. The status moves from Proposed to Accepted. The decision does not change.

- A display cell reads its colours from `useUnistyles()`. `displayFill` in `mobile/src/game/utils/cell.utils.ts`
  turns them into fills (#187).
- The criteria of issue #175 for the grid preview are met, also after Settings opens a second time.
- The wavy lines of the stats card are still open in #175. They are not part of this decision.
