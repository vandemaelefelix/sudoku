import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'
import { columnInset } from '@/theme/column'

// The Settings page in the Op-art language (ADR-026): square corners, one framed block per group with rows divided by the
// box-line weight, and a short wavy rule under each heading. The frame and the rules are the tokens of the stats card.
// Unistyles reads the safe-area insets natively, as on the game screen.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    gap: theme.space.lg,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.lg,
    paddingHorizontal: columnInset(theme, rt.screen.width),
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
  title: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
  section: { gap: theme.space.sm },
  // The heading and its rule sit together, so the rule reads as part of the heading.
  heading: { gap: theme.space.xs },
  sectionTitle: {
    ...roleFont(theme.type.section),
    fontSize: theme.type.section.scale,
    letterSpacing: theme.type.section.scale * theme.type.section.tracking,
    textTransform: 'uppercase',
    color: theme.colors.text,
  },
  hint: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  card: {
    overflow: 'hidden',
    borderRadius: theme.components.summary.radius,
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    backgroundColor: theme.colors.surface,
  },
}))
