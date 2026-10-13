# Correction screen redesign and two new themes

| Field | Value |
| --- | --- |
| Status | Draft, for review |
| Date | 2026-10-13 |
| Design | [Sudoku Correction Screen canvas](https://claude.ai/artifact/XW5UrzdbGyq3cer47yfPPU). Round 3 "Scan-native" is the structure. Round 4 "Op-art" and "Progressive" are the new themes |
| Related | F-06, ADR-011, ADR-015, [scan experience design](../specs/2026-10-11-scan-experience-design.md), [scan pipeline](../../architecture/00-concepts/scan-pipeline.md) |

## Goal

Make the correction screen calm and continuous with the scan transition. Add two themes, Op-art and
Progressive, next to Daylight and Midnight.

## Decisions

| Topic | Decision |
| --- | --- |
| Structure | Round 3: the screen is the last frame of the scan transition. The grid, then one bottom panel. No chips, no cards |
| Themes | Daylight and Midnight stay unchanged. Op-art and Progressive are new light themes. Settings offers System, Daylight, Midnight, Op-art, Progressive. System follows iOS and picks Daylight or Midnight |
| Motifs | Theme decorations (ADR-015, point 9). Op-art: `panelEdge`, 4 wavy cobalt lines. Progressive: `panelEdge`, a band of vertical stripes, and `titleMark`, a black disc. Daylight and Midnight fill no slot |
| Fonts | Bundled with `expo-font`, so the app works offline (SUD-01). Op-art: Instrument Serif, Instrument Sans, IBM Plex Mono. Progressive: Cormorant Garamond, Instrument Sans, DM Mono. All are OFL |
| Digit colours | Givens use `type.given`. Entries stay blue in every theme. An uncertain cell has a dashed ring in `colors.warning` |
| Kind of a cell | Only the dev menu edits the kind. A digit typed into an empty cell becomes a given |
| Level | The level comes from the number of printed givens (ADR-011, scanned puzzles) |
| Dev tools | `__DEV__` only, in one sheet. Play and Save corrections both work in a dev build |

## The screen

1. **Top:** Retake (back to the camera), the title, and a wrench for the dev menu (dev builds only).
2. **Grid:** givens, entries, dashed rings on uncertain cells. Tap a cell to open it in the panel.
3. **Panel, summary state:**
   - "N cells to check ›" (starts the check) or "Ready to play".
   - The level on the right.
   - Play this puzzle and Solve. Solve shows the solution in muted digits, and tap again hides it.
   - Play is off while the play gate blocks. The block text shows above the buttons.
4. **Panel, check state:**
   - Progress dots, one per uncertain cell.
   - The crop of the paper cell, framed by 4 corner dots.
   - "Is this a 4?" with the row and the column.
   - No and "Yes, 4".
5. **Panel, pick state** (after No, or a tap on a sure cell): keypad 1–9 and Empty. The model's
   second guess has a dashed ring.
6. **Flow:** an answer moves to the next uncertain cell. After the last one, the panel goes back to
   the summary state. Close (×) leaves the check at any time.
7. **Dev menu sheet:**
   - Tabs: Photo, Cutout, Overlay, Cells.
   - Switches: Label kinds (Printed, Handwritten, Notes, Empty in the panel), and Show confidence
     (the kind and the % in each cell).
   - A slider for the ring threshold, 0.5 to 0.99. It changes the rings at once and is not saved.
   - Save corrections, on the phone only (SUD-02).

The scan transition already ends on the grid, the rings and the panel. Keep its timings. The panel
grows from `PANEL_HEIGHT` when the keypad shows.

## Work, as one epic with these issues

Every issue needs approval before it is created (AGENTS.md, Work tracking).

1. **ADR-021: four themes.** It amends ADR-015, point 2, and fills the first theme decorations.
   Update `00-DECISIONS.md` and `09-architecture-decisions.md`.
2. **Theme tokens and fonts.**
   - Add `opart` and `progressive` folders in `src/theme/themes/` with all tokens.
   - Extend `ThemeName`, the Settings picker and `SettingsRepository`.
   - The contrast test covers both new themes.
   - Bundle the fonts.
   - Add the theme decoration registry with `panelEdge` and `titleMark`.
3. **Correction screen redesign (F-06).**
   - Rebuild `CorrectionScreen` and `CorrectionPad` to the panel states above.
   - Keep the 576 × 576 flattened grid (`flat`) in memory in every build, to cut the crop for the
     check state.
   - Read the ring threshold from `REVIEW_CONFIDENCE`. Set it to 0.8.
   - Jest tests for the flow: next cell, close, Yes, No, then a digit.
4. **Dev menu sheet.**
   - Move `ScanTabs` and `ScanInspector` into the sheet.
   - Add Label kinds, Show confidence and the threshold slider.
   - Move Save out of the place of Play.
5. **Game and Settings screens in the new themes.** Check every screen in Op-art and Progressive
   on the iPhone.

## Open questions

| Question | Decided by |
| --- | --- |
| The value of `REVIEW_CONFIDENCE`: a cell below it gets a ring. Start at 0.8 (the prototype), not 0.9, so fewer cells show a ring. Tune it later with the dev menu slider and the saved scans. Aim: the rings catch most wrong reads, with about 3 rings or fewer on a normal scan | The developer, after real scans |
| Dark versions of Op-art and Progressive | Later. Not in this epic |
