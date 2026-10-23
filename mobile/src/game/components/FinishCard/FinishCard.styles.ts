import { StyleSheet } from 'react-native-unistyles'
import { roleFont, roleSized } from '@/theme/typography'

const CARD_PADDING = 22
const FRAME_INSET = 7
const SPOT_SIDE = 340
const SPOT_TOP = 90

export const styles = StyleSheet.create((theme, rt) => {
  const card = theme.components.finishCard
  return {
    scrim: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space.xxl,
      paddingTop: rt.insets.top,
      paddingBottom: rt.insets.bottom,
      paddingHorizontal: theme.space.lg,
      backgroundColor: theme.colors.scrimStrong,
    },
    card: {
      width: theme.size.card.width,
      gap: 14,
      paddingTop: CARD_PADDING,
      paddingHorizontal: CARD_PADDING,
      paddingBottom: 16,
      borderRadius: card.radius,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: card.boxLine,
      overflow: 'hidden',
      experimental_backgroundImage: `linear-gradient(150deg, ${card.top} 0%, ${card.middle} 58%, ${card.bottom} 100%)`,
      // The inset line is the catch light on the top edge: the light comes from above.
      boxShadow: `${card.shadow ?? theme.elevation.sheet}, inset 0 1px 0 ${card.shine}`,
    },
    frame: {
      position: 'absolute',
      top: FRAME_INSET,
      left: FRAME_INSET,
      right: FRAME_INSET,
      bottom: FRAME_INSET,
      borderWidth: 1,
      borderColor: card.frame ?? card.shineClear,
      borderRadius: Math.max(0, card.radius - FRAME_INSET),
    },
    shine: {
      position: 'absolute',
      // Taller than the card: the tilt moves the shine up to 135 pt, and a layer of card height shows its edge.
      top: '-60%',
      bottom: '-60%',
      left: '-80%',
      width: '260%',
      experimental_backgroundImage: `linear-gradient(115deg, ${card.shineClear} 38%, ${card.shineCool} 45%, ${card.shine} 50%, ${card.shineWarm} 55%, ${card.shineClear} 62%)`,
    },
    // The card edge runs inside the frame, from one frame line to the other, near the top edge of the card.
    edge: { marginTop: -CARD_PADDING / 2, marginHorizontal: FRAME_INSET - CARD_PADDING, overflow: 'hidden' },
    // The soft reflection of the light, upper left at rest. It fades out long before its edge.
    spot: {
      position: 'absolute',
      left: -SPOT_SIDE / 2 + theme.size.card.width * 0.3,
      top: -SPOT_SIDE / 2 + SPOT_TOP,
      width: SPOT_SIDE,
      height: SPOT_SIDE,
      experimental_backgroundImage: `radial-gradient(circle at center, ${card.shine} 0%, ${card.shineClear} 50%)`,
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
      borderRadius: card.badgeRadius,
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
      borderRadius: card.buttonRadius,
      backgroundColor: theme.colors.accent,
    },
    newPuzzleText: { ...roleSized(theme.type.button), color: theme.colors.onAccent },
    home: { minHeight: theme.size.touch, alignItems: 'center', justifyContent: 'center' },
    homeText: { ...roleSized(theme.type.body), color: theme.colors.text },
  }
})
