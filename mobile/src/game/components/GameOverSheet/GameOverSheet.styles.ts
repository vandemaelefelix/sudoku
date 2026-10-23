import { StyleSheet } from 'react-native-unistyles'
import { roleFont, roleSized } from '@/theme/typography'

// Unistyles reads the safe-area insets natively. The sheet sits on the home indicator area, as on the canvas.
export const styles = StyleSheet.create((theme, rt) => ({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: theme.space.md,
    paddingBottom: rt.insets.bottom,
    backgroundColor: theme.colors.scrim,
  },
  sheet: {
    width: '100%',
    maxWidth: theme.size.content,
    alignSelf: 'center',
    gap: theme.space.sm,
    paddingTop: theme.space.xl,
    paddingHorizontal: theme.space.lg + theme.space.xs,
    paddingBottom: theme.space.md,
    borderRadius: theme.shape.radius.xl,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    boxShadow: theme.elevation.sheet,
  },
  title: { ...roleSized(theme.type.title), color: theme.colors.text },
  body: {
    ...roleSized(theme.type.body),
    lineHeight: Math.round(theme.type.body.scale * 1.4),
    color: theme.colors.textMuted,
  },
  retry: {
    minHeight: theme.size.touch + theme.space.xs,
    marginTop: theme.space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.pill,
    backgroundColor: theme.colors.accent,
  },
  retryText: { ...roleSized(theme.type.button), color: theme.colors.onAccent },
  newPuzzle: {
    minHeight: theme.size.touch + theme.space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.pill,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.line,
  },
  newPuzzleText: { ...roleFont(theme.type.button), fontSize: theme.type.body.scale, color: theme.colors.text },
  home: { minHeight: theme.size.touch, alignItems: 'center', justifyContent: 'center' },
  homeText: { ...roleSized(theme.type.body), color: theme.colors.textMuted },
}))
