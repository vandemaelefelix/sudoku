import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme, rt) => {
  const card = theme.components.finishCard
  return {
    scrim: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space.lg,
      paddingTop: rt.insets.top,
      paddingBottom: rt.insets.bottom,
      paddingHorizontal: theme.space.lg,
      backgroundColor: theme.colors.scrimStrong,
    },
    card: {
      width: theme.size.card.width,
      gap: 14,
      paddingTop: 22,
      paddingHorizontal: 22,
      paddingBottom: 16,
      borderRadius: 24,
      overflow: 'hidden',
      experimental_backgroundImage: `linear-gradient(150deg, ${card.top} 0%, ${card.middle} 58%, ${card.bottom} 100%)`,
      boxShadow: theme.elevation.sheet,
    },
    shine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: '-80%',
      width: '260%',
      mixBlendMode: 'screen',
      experimental_backgroundImage: `linear-gradient(115deg, ${card.shineClear} 30%, ${card.shine} 44%, ${card.shineCool} 50%, ${card.shineWarm} 56%, ${card.shineClear} 68%)`,
    },
    top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    // The canvas shows the title in capitals. The text stays "Solved · Medium" for VoiceOver and the tests.
    title: {
      ...roleFont(theme.type.section),
      fontSize: 12,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: card.textMuted,
    },
    badge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: theme.shape.radius.pill,
      backgroundColor: card.badge,
    },
    badgeText: { ...roleFont(theme.type.label), fontSize: 12, fontWeight: '700', color: card.badgeText },
    time: {
      ...roleFont(theme.type.timer),
      fontSize: 48,
      fontWeight: '700',
      lineHeight: 48,
      fontVariant: ['tabular-nums'],
      color: card.text,
    },
    stats: { flexDirection: 'row', gap: theme.space.sm },
    stat: { flex: 1 },
    statLabel: { ...roleFont(theme.type.caption), fontSize: 11, color: card.textMuted },
    statValue: {
      ...roleFont(theme.type.label),
      fontSize: 17,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      color: card.text,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space.sm,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: card.line,
    },
    source: { ...roleFont(theme.type.caption), flex: 1, fontSize: 13, color: card.text },
    date: { ...roleFont(theme.type.caption), fontSize: 13, color: card.textMuted },
    actions: { width: theme.size.card.width, gap: 6 },
    newPuzzle: {
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.accent,
    },
    newPuzzleText: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.onAccent },
    home: { minHeight: theme.size.touch, alignItems: 'center', justifyContent: 'center' },
    homeText: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.text },
  }
})
