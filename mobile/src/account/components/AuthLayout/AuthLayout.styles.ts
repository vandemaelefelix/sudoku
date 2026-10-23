import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'
import { contentInset } from '@/theme/content'

// The page of the Settings screen: the same header, margins and title (ADR-026).
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    gap: theme.space.lg,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.lg,
    paddingHorizontal: contentInset(theme, rt.screen.width),
  },
  header: { height: theme.size.header, flexDirection: 'row', alignItems: 'center' },
  back: {
    width: theme.size.touch,
    height: theme.size.touch,
    // The icon, not the touch area, lines up with the screen margin.
    marginLeft: -(theme.size.touch - theme.size.icon) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...roleSized(theme.type.title), color: theme.colors.text },
  heading: { gap: theme.space.xs },
}))
