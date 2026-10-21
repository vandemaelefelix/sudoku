---
status: DRAFT
---

# ADR-025: One style, three Op-art colourways

| Field | Value |
| --- | --- |
| Project | Sudoku |
| Status | Proposed |
| Date | 2026-10-14 |
| Contact | Felix |
| Supersedes | Decision 1, 2 and 3 of ADR-021 (the four themes), and the dark splash of ADR-024 |

Amended by [ADR-026](adr-026-appearance.md): each colourway also has a Colour look, and the app can follow the iPhone setting.
The three colourways stay. The rules on the white page, the light-only app (decision 5), the splash and the theme switch change as ADR-026 says.

Amends [ADR-015](adr-015-theming.md): point 2 (the themes and the system setting). Amends
[ADR-021](adr-021-four-themes.md): the decoration table, the fonts and the finish card.

## Context

ADR-021 ships four themes: Daylight, Midnight, Op-art and Progressive. The developer wants one
style only, the Op-art style. The developer also wants more colour in it: a darker green and a
bordeaux red, next to the cobalt blue.

The developer compared seven colours on a colour exploration page. The developer kept three.

The other themes make the app larger and harder to keep:

- Each theme needs its own contrast work.
- Progressive needs two fonts and two decorations that no other theme uses.
- Daylight and Midnight need the dark mode of the iPhone, the splash colours and the System choice.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Keep four themes and add two colours | No removal work | Six themes. The developer wants one style |
| Op-art colourways with a dark mode | Follows the iPhone setting | Doubles the contrast work. The developer did not ask for a dark mode |
| Let the player pick any accent colour | Full freedom | Contrast cannot be checked for every colour |
| **Three Op-art colourways, light only** | One style. Every colourway has a tested palette. Less code | No dark mode. A player who wants Daylight or Midnight loses them |

## Decision

1. **The app ships three themes: Cobalt, Forest and Bordeaux.** All three use the Op-art style.
   Daylight, Midnight, Progressive and System are gone.
2. **A colourway is a palette.** One builder, `buildOpartTheme` in `src/theme/opart/`, makes the
   theme from a name, a label and a palette. Each colourway has a folder in `src/theme/themes/` with
   `palette.ts`, `<name>.ts` and `index.ts`. To add a colourway, add the folder and one registry line.
3. **The palettes derive from one accent colour.** Each tint is the accent mixed with white. The
   values are literal hex in `palette.ts`.

   | Colourway | Accent | Ink | Entry digit | Conflict | Check ring |
   | --- | --- | --- | --- | --- | --- |
   | Cobalt | `#1f3fd1` | `#0f1d5c` | `#2547f0` | `#c4162a` | Orange `#ea6a12` |
   | Forest | `#14603c` | `#0a2a1a` | `#166a42` | `#c4162a` | Orange `#ea6a12` |
   | Bordeaux | `#7b1631` | `#3a0b18` | `#a31d45` | `#a83d06` | Amber `#e0a000` |

   Bordeaux uses dark orange for a conflict and amber for the check ring. Red would look like the
   accent. The conflict and the entry digit pass 4.5 : 1 on their fills in every colourway.
4. **The default is Cobalt.** The saved preference is a theme name. A value of an older version
   (`system`, `daylight`, `midnight`, `opart`, `progressive`) gives Cobalt. Unistyles registers the
   three names and has no adaptive theme. `startupSettings` always gives an initial theme.
5. **The app is light only.** `userInterfaceStyle` in `app.json` is `light`.
6. **Every colourway draws the Op-art decorations.** The slots are `panelEdge`, `cardEdge` and
   `summaryEdge`. The `titleMark` slot and the Progressive decorations are gone.
7. **The splash follows the colourway.** The native splash and the first frame of the overlay are
   white in every colourway, because the native layer cannot read the saved theme. The word and the
   cells take `colors.text`, `colors.accent` and `colors.line` from the saved theme. The dark
   splash colour `#0f1116` is gone. This supersedes decision 6 of ADR-024 in part.
8. **The fonts of Progressive leave the app.** Cormorant Garamond and DM Mono, their licences and
   their `expo-font` lines go away. The Op-art fonts stay.
9. **The app icon stays cobalt.** An icon is a fixed image and cannot follow the saved theme.
10. **A theme switch covers the old screen with a wave of sudoku cells that reveals the new theme.**
    The effect uses the splash cells of ADR-024, in the colours of the new theme. It takes 700 ms.
    It works like a view transition: the old screen stays on top, and a moving boundary reveals the
    new screen. The boundary is the front of the cell wave, and it is not see through.
    - A choice in Settings moves the picker indicator at once. The provider takes the picture
      when the 160 ms slide of the indicator ends, so the picture never cuts the slide.
    - The provider takes a picture of the app with Skia `makeImageFromView`. It draws the picture
      over every screen at full strength. The player sees no change at that moment.
    - The theme switches under the picture, after the first layout of the overlay and one frame.
      The new theme is live under the overlay before the wave starts.
    - The wave starts when the screens have rendered the new theme, and one frame later. A Skia surface
      takes the new colours only in that render. The wave waits 250 ms at most.
    - The wave is the splash exit, sped up. It rises from the bottom row to the top row. Each cell
      has its own delay, as in ADR-024. The wave passes once.
    - Before its peak, a cell grows to solid. The cell is the ground colour with the tint of the new
      accent on top, with the pale lines. It shows no digit: only the splash does. It is a solid, pale
      square at its peak, so the front of the wave hides the old screen.
    - From its peak on, the app erases the picture in the rectangle of that cell. The cell was solid,
      so the player sees no jump. The cell then fades out and shows the live new theme.
    - A cell that the wave has not reached shows the old screen without change.
    - One path of all the cells that have passed their peak is erased from the picture in one draw
      call, inside a layer of its own. Each rectangle grows by `ERASE_OVERLAP` (0.5 points) on every
      side, so no gap shows between two cells. The grid covers the whole window. At the end of the
      wave every cell has erased the picture, so nothing of it remains at the edges.
    - There is no white band and no gradient. The ground colour is only the base of a cell.
    - One provider at the root draws the effect above every screen. It takes no touch.
    - The effect draws before the switch, so it reads the colours from `THEMES[next]`, not from
      the current theme.
    - The provider frees the picture only after the overlay is gone, one frame later. A frame
      that draws a freed picture crashes the app.
    - A choice in Settings during the effect waits. The picker moves at once. When the wave ends, the
      last choice plays its own wave. A choice of the look on screen plays no wave.
    - With Reduce Motion the theme switches at once and nothing draws.
    - If the picture fails or is empty, the theme switches at once and nothing draws. The app logs
      the failure in development.
    - A choice of the theme that is already on plays nothing.

## Consequences

- The app size shrinks by the two unused font families.
- The change needs a new development build, because `app.json` and the font list change.
- A player who saved Daylight, Midnight, Op-art or Progressive sees Cobalt at the next start.
- The contrast test covers three themes, and all three use one builder.
- The app has no dark mode. The iPhone setting changes nothing.
- A theme switch takes 700 ms. A switch from Settings waits 160 ms more for the slide of the picker. A choice during the effect waits for its end, so quick choices play their waves one after the other.
- The picture of the app uses memory for one frame of the screen until the effect ends. The provider frees it then.
- A native modal is not part of the picture, because it lives outside the app view. A switch with a modal open shows no old modal in the effect.
- The splash cells and the picture draw for 700 ms per switch. Each frame builds one path of up to 189 rectangles and one erase. The cost on an older iPhone is not measured.
- A cell is solid for one frame at its peak, so the front of the wave is not see through. Before the peak, a cell is partly see through for about 120 ms.

## Reassessment Triggers

- The developer wants a dark mode. Then a dark palette per colourway and the System choice return.
- The developer wants a fourth colourway. Check its contrast before the app uses it.
- The developer wants the app icon to follow the colourway. Then the icon needs alternate icons.
