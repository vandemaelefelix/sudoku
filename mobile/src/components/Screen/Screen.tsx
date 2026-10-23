import type { ReactNode } from 'react'
import { ScrollView } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { ThemeStatusBar } from '@/components/ThemeStatusBar'
import { styles } from './Screen.styles'

type ScreenProps = {
  children: ReactNode
  /** `stacked` spaces the children by space.lg. `flow` leaves the spacing to the children and ends with more room. */
  layout?: 'stacked' | 'flow'
  /** The page holds text fields: the keyboard moves the content, and a tap on a button works while the keyboard is open. */
  keyboardAware?: boolean
}

/** The page of a secondary screen: the status bar, a scroll view, the safe-area insets and the side margin (ADR-026). */
export function Screen({ children, layout = 'stacked', keyboardAware = false }: ScreenProps) {
  const { theme } = useUnistyles()
  return (
    <>
      <ThemeStatusBar />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, layout === 'stacked' ? styles.stacked : styles.flow]}
        keyboardShouldPersistTaps={keyboardAware ? 'handled' : 'never'}
        automaticallyAdjustKeyboardInsets={keyboardAware}
        // The scroll bar follows the iOS appearance. The page follows the theme, so the two can differ (ADR-026).
        indicatorStyle={theme.scrollIndicator}
      >
        {children}
      </ScrollView>
    </>
  )
}
