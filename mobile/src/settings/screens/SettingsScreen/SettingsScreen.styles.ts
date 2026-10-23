import { StyleSheet } from 'react-native-unistyles'

// The Settings page in the Op-art language (ADR-026): square corners, one framed block per group with rows divided by the
// box-line weight, and a short wavy rule under each heading. The frame and the rules are the tokens of the stats card.
export const styles = StyleSheet.create((theme) => ({
  card: {
    overflow: 'hidden',
    borderRadius: theme.components.summary.radius,
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    backgroundColor: theme.colors.surface,
  },
}))
