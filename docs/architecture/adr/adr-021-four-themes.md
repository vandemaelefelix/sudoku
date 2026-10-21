---
status: DRAFT
---

# ADR-021: Four themes, one theme registry and the first theme decorations

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-13 |
| Contact | Felix      |

Amends [ADR-015](adr-015-theming.md): point 2 (four themes, not two) and point 9 (the first theme
decorations). The other points of ADR-015 stay.

Superseded in part by [ADR-025](adr-025-opart-colourways.md): the app now ships three Op-art colourways. Daylight, Midnight and Progressive are gone.

## Context

ADR-015 ships two themes, Daylight and Midnight. It defines theme decorations as the mechanism for
structure, but builds none.

The correction screen redesign adds two light themes from Round 4 of the
[design canvas](https://claude.ai/artifact/XW5UrzdbGyq3cer47yfPPU):

- **Op-art:** a white page, one cobalt colour (`#1f3fd1`) and wavy parallel lines.
- **Progressive:** a beige page, black only, a black disc and vertical stripes.

These themes change more than colours. They need their own fonts. They also draw structure that
tokens cannot describe: wavy lines, stripes and a disc. So this is the first theme that needs a
theme decoration.

Today the theme names live in several places: the `ThemeName` type, the Settings picker, the saved
preference, the Unistyles registration and the contrast test. A third and a fourth theme would
change each of them by hand.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Keep two themes | No work. No app size growth | The developer chose Op-art and Progressive. The theme decoration mechanism stays untested |
| Dark variants of Op-art and Progressive now | A dark mode for every theme | Doubles the design and the contrast work. Later, not this epic |
| Load the fonts at runtime with `useFonts` | No new development build for a font change | A loading state before the first frame. The theme preference is read synchronously before the first frame, so the first frame would show the wrong font |
| Decorations as booleans in the theme object, for example `hasStripes` | One place for everything | ADR-015 point 9 keeps structure out of the token object. Every component would test flags |
| **Four themes, one theme registry, a decoration registry, fonts bundled at build time** | Adding a theme is a folder and one line. Structure stays outside the tokens. The first frame has the font | The app size grows by the fonts. A font change needs a new development build |

## Decision

1. **The app ships four themes: Daylight, Midnight, Op-art and Progressive.** Daylight and
   Midnight keep their values. Op-art and Progressive are light themes.
2. **Settings offers System, Daylight, Midnight, Op-art and Progressive.** System follows the
   iOS setting and picks Daylight or Midnight. The choice is saved through `SettingsRepository`
   (ADR-012).
3. **Unistyles registers four names.** Daylight is `light` and Midnight is `dark`, because
   adaptive themes need those names. Op-art is `opart` and Progressive is `progressive`.
4. **One theme registry names every theme.** The list `THEMES` in `src/theme/themes/registry.ts`
   holds each theme. Each theme holds its own `label`. These parts read this one list:
   - the Settings picker,
   - the saved preference,
   - the Unistyles registration,
   - the contrast test.

   To add a theme, add its name to `ThemeName`, add a folder and add one registry line.
   TypeScript then names every place that misses the theme. Add fonts and theme decorations only
   when the theme needs them.
5. **Theme decorations have a registry per theme** (ADR-015, point 9). It lives in
   `src/theme/decorations/registry.ts`, outside the Unistyles theme object. It has three slots:

   | Slot | Where | Daylight | Midnight | Op-art | Progressive |
   | --- | --- | --- | --- | --- | --- |
   | `panelEdge` | A band on the top edge of the correction panel | — | — | 4 wavy cobalt lines, drawn with Skia | A band of vertical stripes |
   | `titleMark` | A mark next to the screen title | — | — | — | A black disc |
   | `cardEdge` | A band across the top of the finish card | — | — | 4 wavy white lines, drawn with Skia | — |

   A component renders a slot with `<ThemeDecoration slot="panelEdge" />`. An empty slot renders
   nothing.
6. **The fonts ship inside the app.** The `expo-font` config plugin bundles static TTF files from
   `apps/mobile/assets/fonts`. So the app works offline (SUD-01), and the first frame has the
   font.

   | Theme | Display and question | Text | Mono |
   | --- | --- | --- | --- |
   | Op-art | Instrument Serif | Instrument Sans | IBM Plex Mono |
   | Progressive | Cormorant Garamond | Instrument Sans | DM Mono |

   - All fonts use the SIL Open Font License 1.1.
   - The files are static, because iOS reads variable fonts only from SDK 58.
   - A file has the name of its PostScript name. The type role uses that name as its family.
7. **Every theme fills these new tokens:**
   - The type roles `display` (the big screen title), `question`, `status` and `eyebrow` (small
     caps labels).
   - An `uppercase` flag on a type role.
   - `label`: the name in the Settings picker.
   - `size.titleBlock`: the height of the large title under the top bar. 0 puts the title in the
     top bar, as in Daylight and Midnight.
   - `size.panelEdge`: the height of the `panelEdge` decoration. 0 for none.
   - `components.button`: `primary`, `onPrimary`, `second`, `outline`, `outlineWidth` and
     `radius`.
   - `components.panel`: `fill`, `radius`, `border`, `borderWidth`, `key` (the fill of a keypad
     key) and `keyRadius`.
   - `components.checkRing`: the colour, and round or square.
   - `components.finishCard`: `radius`, `badgeRadius`, `buttonRadius`, `frame` and `shadow`.
     Daylight, Midnight and Progressive use the dark holographic card of the canvas. Op-art uses a
     flat cobalt card with an inset white frame and a deep shadow. The dark card does not belong
     on its white page.
8. **The digit colours follow fixed rules in every theme:**
   - Givens use `type.given`.
   - Entries stay blue. The Op-art entry is `#2547f0`, darker than the canvas `#2b4dff`, because
     the canvas blue on the same-number fill is below 4.5 : 1.
   - An uncertain cell has a dashed ring in `colors.warning`.

## Consequences

- The app size grows by the fonts, about 1 MB.
- A font change needs a new development build.
- A theme switch to or from a decorated theme re-renders only the slot components. The grid does
  not re-render.
- The contrast test covers all four themes.
- A new theme changes `THEMES`, not the picker, the preference or the registration.
- Op-art and Progressive have no dark version. With System, the app shows only Daylight or
  Midnight. The dark versions come later.

## Reassessment Triggers

- The developer picks a fifth theme. Check the app size and the decoration slots.
- The app moves to Expo SDK 58. Variable fonts then allow one file per family.
- The developer wants dark versions of Op-art and Progressive. Then System must pick between more
  than two themes.

## Amendment 2026-10-14: the summary edge

The stats card (ADR-023) shows 4 wavy lines in Op-art, across a white card. The `panelEdge` slot is as wide as the window, and the `cardEdge` slot is as wide as the finish card and white. Neither fits.

1. **A fourth slot, `summaryEdge`.** It is a band on the top edge of the stats card.

   | Slot | Where | Daylight | Midnight | Op-art | Progressive |
   | --- | --- | --- | --- | --- | --- |
   | `summaryEdge` | A band on the top edge of the stats card | — | — | 4 wavy lines in `colors.lineStrong`, as wide as the content column | — |

   The height of the band is `size.panelEdge`. A theme with `size.panelEdge` of 0 draws nothing.
2. **A component token group, `components.summary`.** It holds `border`, `borderWidth`, `radius`, `rule` and `ruleWidth`. The stats card, the empty state of a level and the strong rules of the stats screen (the table header and the chart base) read it. The lines between the sections use the thin `colors.line`, so they do not crowd the sections. `radius` equals `components.button.radius` in all four themes.
3. **A component token group, `components.tabs`.** It holds `track` and `selected`, the colours of the tab bar of the stats screen. The values equal `components.segmented` in all four themes. A component reads only its own group (apps/mobile/AGENTS.md, Theme, rule 4), so the tab bar does not borrow the group of the theme picker.

## Amendment 2026-10-21: one family on the grid

A given used Instrument Serif and a typed digit used Instrument Sans Medium. The two families clashed on the grid (#163).

1. **A typed digit uses Instrument Serif Italic.** The `entry` role of Op-art is `InstrumentSerif-Italic`, weight 400, at 28 points. The upright reads as print and the italic reads as a hand. So the style, not only the colour, tells a typed digit from a given.
2. **A fifth Op-art file.** `InstrumentSerif-Italic.ttf` joins the bundled fonts. It uses the licence file of Instrument Serif. A change of the font list needs a new development build.
3. **Notes stay in Instrument Sans Medium.** A serif italic at 11 points is hard to read.
