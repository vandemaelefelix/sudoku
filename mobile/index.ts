// StyleSheet.configure must run before any StyleSheet.create (ADR-015).
// oxlint-disable-next-line import/no-unassigned-import -- the module registers the themes as its side effect.
import '@/theme/unistyles'
import { logIntlSupport } from '@/i18n/intlSupport'
// oxlint-disable-next-line import/no-unassigned-import -- the module adds the Intl APIs that Hermes lacks (ADR-033).
import '@/i18n/polyfills'
import { runDevChecks } from './devChecks'
// Expo Router wants its entry imported last in a custom entry (ADR-016).
// oxlint-disable-next-line import/no-unassigned-import -- the module registers the root component as its side effect.
import 'expo-router/entry'

runDevChecks()
logIntlSupport()
