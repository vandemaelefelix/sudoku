---
status: DRAFT
---

# ADR-033: Translations with FormatJS: message catalogues, English and Dutch

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-22 |
| Contact | Felix      |

Amends [ADR-032](adr-032-hints-that-teach.md): the hint text of `@sudoku/core` becomes message ids with values. Amends
[ADR-012](adr-012-local-persistence.md): one more saved setting.

## Context

All text of the app is English. It lives in the components, in constants files and in `@sudoku/core`. The developer plays in
Dutch too. Issue #221 asks for message catalogues and a language switcher, with English and Dutch first.

Three facts shape the choice:

- The hint text of `@sudoku/core` is built from English grammar: "row 4, column 9", "a, b and c", "an 8", "columns 1 and 5".
  A translation of whole sentences cannot reach those parts.
- The app runs on Hermes. Hermes has `Intl.NumberFormat`, `Intl.DateTimeFormat` and `Intl.getCanonicalLocales` on iOS, with
  limits: no `formatToParts` and no compact notation on iOS. The FormatJS sources disagree on `Intl.PluralRules` and
  `Intl.Locale` in recent Hermes. Hermes has no `Intl.RelativeTimeFormat`, `Intl.ListFormat` or `Intl.DisplayNames`.
- The app works offline (SUD-01), so the catalogues ship with the app.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| **FormatJS (`react-intl`), ICU messages** | The standard for ICU plurals, numbers and dates. Typed message ids. Polyfills for Hermes. A small runtime | A polyfill load at start |
| i18next with `react-i18next` | Popular. Namespaces | Its own plural format, not ICU. ICU needs a plugin |
| Lingui | Compile step, small runtime | A Babel macro on top of Expo's Babel. Fewer users in React Native |
| Own lookup table | No dependency | Plurals, numbers and dates by hand, the bugs that ICU already solved |

For the hint text of the core:

| Option | For | Against |
| --- | --- | --- |
| **The core returns message ids with structured values** | The core holds no player text. Each language builds a cell name, a list and a plural its own way | The hint code changes, and the text tests move to the app |
| The core returns English, and the app maps sentences | No core change | The sentences hold numbers and lists, so a map cannot cover them |
| The core holds the catalogues of both languages | One place for the hint wording | The core gets an ICU dependency, and the catalogues live in two packages |

## Decision

1. **FormatJS.** The app uses `react-intl` with ICU message syntax. Text comes from `intl.formatMessage`. Plurals use
   `{count, plural, …}`. Numbers and dates use `formatNumber` and `formatDate`. The versions are pinned.
2. **The catalogues live in `mobile/src/i18n/messages/`.** One flat object per language: `en.ts` and `nl.ts`. `en.ts` is the
   source. `nl.ts` has the type `Record<MessageId, string>`, so a missing Dutch message fails `just typecheck`.
3. **Message ids.** An id is `<feature>.<part>.<name>` in camelCase, for example `settings.language.title` or
   `hint.nakedPair.why`. The ids are typed through the `FormatjsIntl.Message` interface, so an unknown id fails the typecheck.
4. **One word, one meaning, in each language.** The glossary is the English dictionary. `mobile/src/i18n/messages/nl.words.md`
   is the Dutch one: one Dutch word for each term that the player sees. The Dutch is the Dutch of Flanders.
5. **The language setting.** The setting store entry `app.language` holds `system`, `en` or `nl`. `system` reads the
   preferred languages of iOS through `expo-localization`. It takes the first language that the app has, else English. The
   app lists `CFBundleLocalizations`, so iOS also offers a language for this app alone. The formatting locale is the device
   tag when its language matches, for example `nl-BE`. Else it is the language alone.
6. **Hermes polyfills, only when needed.** `src/i18n/polyfills.ts` loads first, in `mobile/index.ts`. It loads
   `@formatjs/intl-getcanonicallocales`, `@formatjs/intl-locale` and `@formatjs/intl-pluralrules` with the `en` and `nl`
   data, each only when its `shouldPolyfill` says the runtime lacks it. A development build logs what it loaded.
7. **No `Intl` API that Hermes lacks.** The app does not use `RelativeTimeFormat`, `ListFormat`, `DisplayNames` or
   `formatToParts`. "5 min ago" is an ICU plural. A list joins with the words of the catalogue. A language name is a fixed
   word in its own language: "English", "Nederlands".
8. **The hint text of the core is ids with values (amends ADR-032).** `hintMessage(plan, step, rung)` returns
   `{ id, values }`. A value is a number or a typed part: a cell, cells, a unit, cells in a unit, lines, or a list of digits
   with "and" or "or". The app formats each part from the catalogue. The core holds no player text. ADR-032 point 10 holds in
   every language: a cell is "row 4, column 9" or "rij 4, kolom 9", never "r4c9".
9. **The iOS texts.** Info.plist text, such as the camera text and the app name, cannot use `react-intl`. Expo `locales` in
   `app.json` gives them a Dutch version.
10. **A check finds text outside the catalogues.** `tools/i18n/check-text.mjs` runs in `just lint`. It refuses JSX text with
    letters, and string literals in `label`, `title`, `accessibilityLabel`, `accessibilityHint`, `placeholder` and
    `Alert.alert`. Screens that only a development build shows are on a short list. Log text, test ids and storage keys stay
    English.

## Consequences

- Every new text needs an id and a Dutch message in the same change. The typecheck refuses a missing one.
- Utils that build text get the formatter as a parameter, so they import no React.
- The hint tests of the core check ids and values. The English and Dutch wording tests live in the app.
- `expo-localization` is a native module, so it needs a new development build.
- A third language is one more catalogue, one more word list and one more option in Settings.
- The check does not see text in a constants file that a component renders. Review catches it. The constants hold ids now.

## Reassessment Triggers

- Hermes gets the full `Intl`: drop the polyfills.
- A third language, or a language that reads right to left.
- The catalogues grow past what one file per language can hold: split by feature.
- The project starts to use a translation service: extract the catalogues with `@formatjs/cli`.
