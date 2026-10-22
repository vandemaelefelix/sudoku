---
status: ACCEPTED
---

# ADR-026: Appearance: Auto, Light and Colour

| Field | Value |
| --- | --- |
| Project | Sudoku |
| Status | Accepted |
| Date | 2026-10-14 |
| Contact | Felix |
| Supersedes | Decision 1 of ADR-025 in part (three themes in total, light only, no dark mode, no System choice) and the white-only splash text of ADR-024 in part |

Amends [ADR-025](adr-025-opart-colourways.md): decisions 2, 5, 7 and 10 (the builder, the light-only app, the splash colours and the
theme switch). The other points of ADR-025 stay.

## Context

ADR-025 ships three Op-art colourways. All three have a white page and coloured content.
The developer wants a second look for each colourway, "full colour": the accent is the page and the content is light.
The developer approved the look on the colour exploration page, with an Appearance toggle.

The developer also wants the app to follow the iPhone setting, if the player wants it:
a dark iPhone gives the full colour look.

So each colourway has two looks, and the player chooses how the app picks one.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Follow the iPhone dark mode only, no choice | No setting | The player cannot have Colour on a light iPhone, or Light on a dark iPhone |
| A separate dark theme, with its own palette | Free design for a dark look | A fourth style. The developer wants one style and the colours of the accent |
| A second set of hand-written palettes, three more folders | Full control of each value | Six palettes to keep. Values drift. Contrast work is done twice |
| Unistyles adaptive themes | The system switches the theme with no code | Adaptive themes need the names `light` and `dark`, so they allow two themes, not six |
| **Appearance with three values (Auto, Light, Colour). The Colour look derives from the accent in the builder** | Six looks from three palettes. One place for the rules. The player chooses | A new saved preference. A native config change |

## Decision

1. **The app has an Appearance setting with three values.** It sits under the colourway picker in Settings, as a
   segmented control with the same sliding indicator.
   - **Light:** a white page with coloured content. This is the look of ADR-025.
   - **Colour:** the accent is the page. The content is white or light.
   - **Auto:** the iPhone setting decides. A light iPhone gives Light. A dark iPhone gives Colour.
   - The default for a new install is Light, not Auto. A value that is not known gives Light.
2. **The six looks are three colourways in two appearances.** A look is a colourway and a resolved appearance, Light or Colour.
   `Theme.appearance` holds it. Auto is a preference, never the appearance of a theme.
3. **Two preferences are saved.** The colourway keeps its key `theme.preference`. The appearance has the new key `theme.appearance`
   with the values `auto`, `light` and `colour`. Each is read before the first frame.
4. **Unistyles registers six themes.** The Light themes keep their names: `cobalt`, `forest` and `bordeaux`. The Colour themes add
   `-colour`: `cobalt-colour`, `forest-colour` and `bordeaux-colour`. Adaptive themes stay off. The Light themes come first,
   so Jest uses Cobalt.
5. **The builder derives the Colour look.** `buildOpartTheme` takes the appearance as one more argument. `opart.light.ts`
   holds the Light look and `opart.colour.ts` holds the Colour look. A colourway folder adds one value to its palette,
   `colourEntry`, the light tint of its typed digits. Each folder exports its Light theme and its Colour theme.
   A theme folder does not import another folder.
6. **The Colour roles come from the accent `A`.** The page is `A` mixed with black by 0.16. `white(k)` is the page with white laid over it by `k`.

   | Role | Colour look |
   | --- | --- |
   | Page and surface | The page |
   | Text, accent, given digits | White |
   | Muted text | `white(0.8)` |
   | Notes | `white(0.9)` |
   | Cell line, panel line | `white(0.3)` |
   | Box and frame line | `white(0.9)` |
   | Wave line | `white(0.55)` |
   | Peer, same-number cell | `white(0.07)`, `white(0.15)` |
   | Selected cell | `white(0.20)` with a 2 point white ring. The digits keep their colours |
   | Typed digit | The `colourEntry` of the colourway: `#e0e7ff`, `#c9f6dc`, `#ffd9e4` |
   | Conflict | The peer fill with white diagonal stripes at 45° and a white digit. See decision 8 |
   | Danger text and fill outside the grid | Amber `#ffc94d` |
   | Uncertain-cell ring | A white dashed ring, so it never reads as a conflict |
   | Number key, panel key | `white(0.14)` |
   | Toggle | On: a white track with a page-coloured thumb. Off: an outlined track with a white thumb. See decision 9 |
   | Segmented control and stats tabs | A row of grid cells. See decision 10 |
   | Primary button | A white fill with the page colour for text |
   | Finish card | A white card with the page colour for text and lines |
   | Scrim | The page colour with alpha |
   | Status bar and scroll bars | Light |

   The muted text is lighter than the first mock-up (0.72), because it also sits on a key. The muted text on the finish card is
   darker than the mock-up, for the same reason. The contrast test covers all six themes with the same rules.
7. **Tokens carry the selected ring, the hatch, the toggle and the scroll bars.** `cell.selectedRingWidth` is 0 in Light and 2 in
   Colour. `cell.conflictHatch` holds the stripes of a conflict, and it is null in Light. `switch` holds `on`, `off`, `border`,
   `thumbOn` and `thumbOff`. `Theme.scrollIndicator` holds the colour of the scroll bars. The tokens `segmented` and `tabs`
   are gone, because both controls use the tokens of the grid cells.
8. **A conflict cell in Colour has a hatch.** The cell keeps the peer fill, and `ConflictHatch` draws white stripes at 45° with a
   small Skia canvas, only in conflict cells. A white digit is on top. The stripes are 1.6 points wide with a pitch of 5 points
   along the x axis. The first mock-up had an opacity of 0.55. The white digit on such a stripe has a contrast near 2.2 : 1, so the
   opacity is 0.2. The digit on a stripe then has at least 4.7 : 1 in every colourway. Light keeps its danger fill and digit.
9. **The toggle is boxy and the same in both looks.** The native `Switch` is gone. `Toggle` draws a 52 by 28 point track with a
   1.5 point border and a square thumb of 18 points. The corners use the radius of the button tokens, 0. The thumb slides in 160 ms
   with Reanimated and jumps with Reduce Motion. It has the role `switch`, a checked state and a 44 point touch target.
   Light: on is an accent track with a white thumb. Off is an outlined track with an accent thumb.
   Colour: on is a white track with a page-coloured thumb. Off is an outlined track with a white thumb.
   The contrast test needs 3 : 1 between the thumb and the track in each state.
10. **A segmented control and the stats tabs are a row of grid cells.** `SegmentedControl` draws square cells in a frame of 1.5 points,
    divided by lines of 1.5 points. There is no filled track. The selected cell has the fill and the 2 point ring of the selected
    cell of the grid, with the accent as the label colour. The unselected cells have the page colour and muted text.
    The cells have equal widths: the width of the content box of the frame divided by the number of cells. The dividers are lines of
    their own, centred on the edges between the cells. The indicator is exactly one cell, flush with the frame, with its ring drawn
    inside it. It slides with one timing of 220 ms. The first layout, a new width and Reduce Motion place it at once. The Theme picker, the Appearance picker and the stats tabs share this component.
11. **The Settings page follows the Op-art look.** Each group is one framed block with square corners. The frame and the rules are the tokens of the
    stats card. Rows are divided by the strong rule of the weight of the box lines. The preview is the game grid itself. Each
    section heading is a mono uppercase eyebrow with a short wavy rule under it. The rule is the new `sectionRule` decoration slot. It
    reuses the wave geometry of the panel edge and draws 2 of its 4 lines.
12. **The splash starts in the saved look.** The native splash is static and white, and it cannot know the saved look. So the first
    frame of the overlay is white and equals it. The ground then fades from white to the page colour of the saved look in 150 ms, inside
    the hold before the first letter. The word, the cells and the ground of the exit use the colours of the saved look:
    the text, the accent and the line. In Light the page is white, so Light behaves as before. In Colour the cells are white on
    the page. The exit wave then reveals the home in the same look. This replaces the rule of an earlier version of this ADR, which
    used the Light variant in every look.
13. **A theme switch uses the same cell wave for both choices.** A change of the colourway and a change of the appearance both
   play the wave of ADR-025, decision 10. The target is the combined theme. The cells are a decoration over the picture of
   the old screen. They always take the tint of the Light variant of the target colourway, over a white base, in both
   appearances. This keeps the effect the same in every direction. A choice that gives the look that is on screen plays no wave.
   Auto to Light on a light iPhone is such a choice.
14. **Auto follows the iPhone setting while the app runs.** A root component reads the system scheme. When the appearance is Auto
    and the scheme changes, it plays the wave and applies the new look. When the app is not in the foreground, it applies the look
    at once. At the start, `startupSettings` resolves Auto with the system scheme, so the first frame already has the right theme.
15. **`userInterfaceStyle` becomes `automatic` in `app.json`.** The app must read the iPhone setting for Auto. This is a native
    config change, so the app needs a new development build. The native splash stays white in both modes.

## Consequences

- The app has six looks. The player can choose a Colour look on a light iPhone, and a Light look on a dark iPhone.
- The system UI follows the iPhone setting, not the look of the app. These parts are not themed:
  - The keyboard and the alerts of the system. The only alert is the reset of the stats. It is readable in both looks.
  - The default status bar. The app sets the status bar from the theme on every screen, so this does not show.
  - The scroll bars. The app sets them from the theme.
- The switches are drawn by the app, so they follow the look. Only the system alert and the keyboard follow the iPhone.
- The first native frame is white for every Colour look. The native layer cannot change that. With Auto on a dark iPhone, a dark native splash variant is possible. It cannot know the colourway, so it would be a neutral dark colour that differs from the page. The app does not use it.
- The camera screen keeps its fixed colours. It does not change with the appearance.
- The app icon stays as it is, because an icon cannot follow the preference.
- A player who saved nothing sees Light, so an update changes nothing for that player.
- The change needs a new development build, because `userInterfaceStyle` changes.
- A new colourway needs its Light palette and one `colourEntry`. The contrast test then checks both looks.

## Reassessment Triggers

- The white flash of the native splash disturbs players of a Colour look. Then the app adds a dark native splash for a dark iPhone.
- A player reports that the white cells of the theme-switch wave look wrong on a Colour page. Then the wave takes the Colour tint.
- The app needs a dark look that is not the accent as the page. Then it is a new ADR with its own palette.
- The iPhone setting flicker at the start of the app causes a flash of the wrong look. Then Auto waits for the first scheme event.
- The developer wants the app icon to follow the look. Then the icon needs alternate icons.

## Amendment 2026-10-21: stronger grid highlights

In Colour, each fill step was 1.1 to 1.2 : 1 against the next. The row, the column and the box of the selected cell were hard to see. A wrong digit was white, the colour of a given. In Light, a peer was 1.08 : 1 against the page, and the selected cell was lighter than the same-number cells (#163).

1. **The Colour page is darker.** The page is `A` mixed with black by 0.30, not 0.16. At 0.16 the typed digit on a lighter fill fell below 4.5 : 1 before the peers stood out.
2. **The Colour fills have wider steps.** This replaces the peer, same-number and selected rows of decision 6.

   | Role | Value |
   | --- | --- |
   | Peer, same-number cell | `white(0.12)`, `white(0.20)` |
   | Selected cell | `white(0.24)` with a 3 point white ring. The digits keep their colours |

   A peer has at least 1.37 : 1 against the page. The weakest digit on the selected cell has 4.72 : 1, in Forest.
3. **A wrong digit in Colour is amber.** This replaces the conflict row of decision 6 and the colour of decision 8. The digit is `#ffc94d`, the amber of danger text. The stripes are the same amber at 0.25 opacity. The pattern of decision 8 stays. The amber digit has at least 3.28 : 1 on a stripe and 5.18 : 1 on the fill.
4. **Light rings the selected cell too.** This replaces the Light value of decision 7: `cell.selectedRingWidth` is 2 in Light and 3 in Colour. The Light ring is the accent. A peer is `tint100` and a same-number cell is `tint200`. The selected cell stays `tint150`, so its notes in muted text pass 4.5 : 1. The palettes drop `tint175` and `tint050`, which no role uses now.
5. **The app icon keeps its ground.** The iOS dark icon of ADR-022 stays the accent darkened 16 %. The icon is its own design.

## Amendment 2026-10-22: accepted

The code on `develop` proves this decision. The status moves from Proposed to Accepted. The decision does not change.

- The Appearance setting and the six looks shipped in #114.
- `mobile/src/theme/system/` follows the iPhone setting for Auto. `mobile/app.json` sets `userInterfaceStyle` to
  `automatic`.
- #188 built the amendment of 2026-10-21.

## Amendment 2026-10-22: the selection frame lies on the grid lines

The ring of decision 7 was a border of the selected cell. React Native draws a border inside its view. Next to a grid
line, the ring and the line showed as two parallel lines (#250). This amendment changes where the ring is drawn. The
tokens and the colours of decision 7 and of the amendment of 2026-10-21 do not change.

1. **The grid draws one selection frame above its lines.** The cell itself draws only its fill. The frame is a stroke of
   `cell.selectedRingWidth` in `cell.ring`.
2. **The stroke is centred on the lines around the cell.** It is at least as wide as a box line, so it covers the line
   below it. A cell next to a box line looks as clean as a cell in the middle of a box.
3. **The frame stays inside the grid.** At the outer edge it is clamped into the grid frame, so nothing clips it.
4. **Without the selected-cell assist,** the frame is `shape.stroke.ring` wide and the cell has no fill.
5. **One component for every grid with a selection:** `SelectionFrame`. The game grid, the Settings preview and the
   correction screen use it. An uncertain cell on the correction screen keeps its own dashed ring.
6. **Motion.** The frame slides to a new cell in 120 ms. With Reduce Motion it jumps. A pause or an open hint hides it at
   once.

The segmented control of decision 10 is not a grid, so it keeps its ring inside its cell.
