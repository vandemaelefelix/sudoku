import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

// The Settings page in the Op-art language (ADR-026): square corners, one framed block per group with rows divided by the
// box-line weight, and a short wavy rule under each heading. The frame and the rules are the tokens of the stats card.
export const styles = StyleSheet.create((theme) => ({
  section: { gap: theme.space.sm },
  // The heading and its rule sit together, so the rule reads as part of the heading.
  heading: { gap: theme.space.xs },
  sectionTitle: {
    ...roleSized(theme.type.section),
    letterSpacing: theme.type.section.scale * theme.type.section.tracking,
    textTransform: 'uppercase',
    color: theme.colors.text,
  },
  hint: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
  card: {
    overflow: 'hidden',
    borderRadius: theme.components.summary.radius,
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    backgroundColor: theme.colors.surface,
  },
}))
