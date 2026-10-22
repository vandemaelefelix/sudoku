// The Intl polyfills of FormatJS for Hermes (ADR-033, point 6). Each polyfill.js defines its API only when the runtime lacks it,
// and the locale data only fills a polyfill. The order is the order of their dependencies.
// oxlint-disable-next-line import/no-unassigned-import -- the module defines Intl.getCanonicalLocales as its side effect.
import '@formatjs/intl-getcanonicallocales/polyfill.js'
// oxlint-disable-next-line import/no-unassigned-import -- the module defines Intl.Locale as its side effect.
import '@formatjs/intl-locale/polyfill.js'
// oxlint-disable-next-line import/no-unassigned-import -- the module defines Intl.PluralRules as its side effect.
import '@formatjs/intl-pluralrules/polyfill.js'
// oxlint-disable-next-line import/no-unassigned-import -- the module adds the English plural rules to the polyfill.
import '@formatjs/intl-pluralrules/locale-data/en.js'
// oxlint-disable-next-line import/no-unassigned-import -- the module adds the Dutch plural rules to the polyfill.
import '@formatjs/intl-pluralrules/locale-data/nl.js'
