// StyleSheet.configure must run before any StyleSheet.create (ADR-015).
// oxlint-disable-next-line import/no-unassigned-import -- the module registers the themes as its side effect.
import '@/theme/unistyles'
import { registerRootComponent } from 'expo'

import App from './App'

registerRootComponent(App)
