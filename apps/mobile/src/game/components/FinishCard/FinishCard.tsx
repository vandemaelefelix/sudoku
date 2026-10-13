import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AccessibilityInfo, Pressable, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type LayoutAnimation,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import type { Game } from '@sudoku/core'
import { CardGrid } from '@/game/components/CardGrid'
import { Icon } from '@/game/components/Icon'
import { GLARE_REST, SHINE_TRAVEL } from '@/game/constants/tilt.constants'
import { useCardTilt } from '@/game/hooks/useCardTilt'
import { useGameState } from '@/game/hooks/useGameState'
import { useLeave, type LeaveCallback } from '@/game/hooks/useLeave'
import { useGameTime } from '@/game/hooks/useGameTime'
import { useSolveDelay } from '@/game/hooks/useSolveDelay'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { finishView, type FinishInfo, type FinishView } from '@/game/utils/finish.utils'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { easeOut, riseIn } from '@/utils/motion.utils'
import { pressedStyles } from '@/theme/pressed.styles'
import { FACE_DELAY_MS, FACE_RISE, FACE_STAGGER_MS, RISE_OFFSET } from './FinishCard.constants'
import { styles } from './FinishCard.styles'

type FinishCardProps = {
  info: FinishInfo
  /** Without it, the card has no New puzzle button. */
  onNewPuzzle?: LeaveCallback | undefined
  onHome(): void
  /** The date on the card. Tests give a fixed date. */
  now?: () => Date
}

/** Renders nothing until the game is won and its solve pulse is over. This gate reads no time, so a tick does not render it. */
export function FinishCard(props: FinishCardProps) {
  const { board } = useGameState()
  const shown = useSolveDelay(board.status === 'won')
  if (!shown) return null
  return <Finish board={board} {...props} />
}

const currentDate = () => new Date()

// A still card shows the glare as at rest.
const STILL_GLARE = { opacity: GLARE_REST }

function Finish({ board, info, onNewPuzzle, onHome, now = currentDate }: FinishCardProps & { board: Game }) {
  const playedMs = useGameTime()
  const [finishedAt] = useState(now)
  const view = finishView(board, playedMs, info, finishedAt)
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  const card = useRef<View>(null)
  const { play } = useHaptics()
  const newBest = view.newBest
  // The scrim hides the grid, but VoiceOver focus stays on the key that won the game.
  // A new best lands with a thud: the solve already played its success haptic.
  // The card lands once. A change of Reduce Motion while it shows must not focus it or thud again.
  const hasLanded = useRef(false)
  const landed = useCallback(() => {
    if (hasLanded.current) return
    hasLanded.current = true
    if (card.current) AccessibilityInfo.sendAccessibilityEvent(card.current, 'focus')
    if (newBest) play('thud')
  }, [newBest, play])
  // 1 is the start of the rise and 0 its end. With Reduce Motion the card starts at its end.
  const rise = useSharedValue(reduceMotion ? 0 : 1)
  useEffect(() => {
    if (reduceMotion) {
      landed()
      return
    }
    rise.set(
      withTiming(0, { duration: theme.motion.medium, easing: easeOut }, (finished) => {
        if (finished) scheduleOnRN(landed)
      }),
    )
    // landed keeps its identity: the result of a won game does not change.
  }, [landed, reduceMotion, rise, theme.motion.medium])
  // The sheet sinks before the new game shows. The game-screen route takes Back to home away.
  const { leaveThen, guard } = useLeave(rise)
  // With Reduce Motion the parts only fade.
  const faceRise = reduceMotion ? 0 : FACE_RISE
  const partIn = (part: number) => riseIn(FACE_DELAY_MS + part * FACE_STAGGER_MS, faceRise, theme.motion.medium)
  // The buttons fade in after the card lands, so the eye reads the result first.
  const actionsIn = riseIn(theme.motion.medium, 0, theme.motion.short)
  // The scrim fades with the rise, so the board does not go dark before the sheet arrives.
  const fadeStyle = useAnimatedStyle(() => ({ opacity: 1 - rise.value }))
  const riseStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value * RISE_OFFSET }] }))
  const face = (
    <>
      {theme.components.finishCard.frame !== null && <View style={styles.frame} pointerEvents="none" />}
      <Face view={view} board={board} iconColor={theme.components.finishCard.textMuted} partIn={partIn} />
    </>
  )
  return (
    <Animated.View testID="finish" style={[styles.scrim, fadeStyle]} accessibilityViewIsModal>
      <Animated.View style={riseStyle}>
        {reduceMotion ? (
          <View ref={card} testID="finish-card" style={styles.card} accessible accessibilityLabel={view.label}>
            <View style={[styles.shine, STILL_GLARE]} pointerEvents="none" />
            <View style={[styles.spot, STILL_GLARE]} pointerEvents="none" />
            {face}
          </View>
        ) : (
          <TiltingCard cardRef={card} label={view.label} shineTravel={theme.size.card.width * SHINE_TRAVEL}>
            {face}
          </TiltingCard>
        )}
      </Animated.View>
      <Animated.View entering={actionsIn} style={styles.actions}>
        {onNewPuzzle && (
          <Pressable
            accessibilityRole="button"
            onPress={() => leaveThen(onNewPuzzle)}
            style={({ pressed }) => [styles.newPuzzle, pressed && pressedStyles.pressed]}
          >
            <Text style={styles.newPuzzleText}>New puzzle</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => guard(onHome)}
          style={({ pressed }) => [styles.home, pressed && pressedStyles.pressed]}
        >
          <Text style={styles.homeText}>Back to home</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}

type TiltingCardProps = {
  cardRef: RefObject<View | null>
  label: string
  shineTravel: number
  children: ReactNode
}

/** A separate component: useCardTilt starts the sensor, and with Reduce Motion on the sensor must not start (ADR-017). */
function TiltingCard({ cardRef, label, shineTravel, children }: TiltingCardProps) {
  const { cardStyle, shineStyle, spotStyle } = useCardTilt(shineTravel)
  return (
    <Animated.View
      ref={cardRef}
      testID="finish-card"
      style={[styles.card, cardStyle]}
      accessible
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none" />
      <Animated.View style={[styles.spot, spotStyle]} pointerEvents="none" />
      {children}
    </Animated.View>
  )
}

type FaceProps = {
  view: FinishView
  board: Game
  iconColor: string
  /** The entering animation of a part of the face. The parts count from 0 at the top: title, time, grid, stats, footer. */
  partIn(part: number): () => LayoutAnimation
}

function Face({ view, board, iconColor, partIn }: FaceProps) {
  return (
    <>
      <ThemeDecoration slot="cardEdge" style={styles.edge} />
      <Animated.View entering={partIn(0)} style={styles.top}>
        <Text style={styles.title}>{view.title}</Text>
        {view.newBest && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>New best</Text>
          </View>
        )}
      </Animated.View>
      <Animated.View entering={partIn(1)}>
        <Text style={styles.time}>{view.time}</Text>
      </Animated.View>
      <Animated.View entering={partIn(2)}>
        <CardGrid board={board} />
      </Animated.View>
      <Animated.View entering={partIn(3)} style={styles.stats}>
        <Stat label="Mistakes" value={view.mistakes} />
        <Stat label="Hints" value={view.hints} />
        <Stat label="Best" value={view.best} />
      </Animated.View>
      <Animated.View entering={partIn(4)} style={styles.footer}>
        {view.fromPaper && <Icon name="scan" tone="text" size={16} color={iconColor} />}
        <Text style={styles.source}>{view.source}</Text>
        <Text style={styles.date}>{view.date}</Text>
      </Animated.View>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}
