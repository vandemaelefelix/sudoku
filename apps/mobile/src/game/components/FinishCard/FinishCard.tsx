import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AccessibilityInfo, Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import type { Game } from '@sudoku/core'
import { CardGrid } from '@/game/components/CardGrid'
import { Icon } from '@/game/components/Icon'
import { SHINE_TRAVEL } from '@/game/constants/tilt.constants'
import { useCardTilt } from '@/game/hooks/useCardTilt'
import { useGameState } from '@/game/hooks/useGameState'
import { useGameTime } from '@/game/hooks/useGameTime'
import { useSolveDelay } from '@/game/hooks/useSolveDelay'
import { finishView, type FinishInfo, type FinishView } from '@/game/utils/finish.utils'
import { RISE_OFFSET } from './FinishCard.constants'
import { styles } from './FinishCard.styles'

type FinishCardProps = {
  info: FinishInfo
  /** Without it, the card has no New puzzle button. */
  onNewPuzzle?: (() => void) | undefined
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

function Finish({ board, info, onNewPuzzle, onHome, now = currentDate }: FinishCardProps & { board: Game }) {
  const playedMs = useGameTime()
  const [finishedAt] = useState(now)
  const view = finishView(board, playedMs, info, finishedAt)
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  const card = useRef<View>(null)
  // The scrim hides the grid, but VoiceOver focus stays on the key that won the game.
  const focusCard = useCallback(() => {
    if (card.current) AccessibilityInfo.sendAccessibilityEvent(card.current, 'focus')
  }, [])
  // 1 is the start of the rise and 0 its end. With Reduce Motion the card starts at its end.
  const rise = useSharedValue(reduceMotion ? 0 : 1)
  useEffect(() => {
    if (reduceMotion) {
      focusCard()
      return
    }
    rise.set(
      withTiming(0, { duration: theme.motion.medium, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(focusCard)
      }),
    )
  }, [focusCard, reduceMotion, rise, theme.motion.medium])
  const riseStyle = useAnimatedStyle(() => ({
    opacity: 1 - rise.value,
    transform: [{ translateY: rise.value * RISE_OFFSET }],
  }))
  const face = <Face view={view} board={board} iconColor={theme.components.finishCard.textMuted} />
  return (
    <View testID="finish" style={styles.scrim} accessibilityViewIsModal>
      <Animated.View style={riseStyle}>
        {reduceMotion ? (
          <View ref={card} testID="finish-card" style={styles.card} accessible accessibilityLabel={view.label}>
            <View style={styles.shine} pointerEvents="none" />
            {face}
          </View>
        ) : (
          <TiltingCard cardRef={card} label={view.label} shineTravel={theme.size.card.width * SHINE_TRAVEL}>
            {face}
          </TiltingCard>
        )}
      </Animated.View>
      <View style={styles.actions}>
        {onNewPuzzle && (
          <Pressable accessibilityRole="button" onPress={onNewPuzzle} style={styles.newPuzzle}>
            <Text style={styles.newPuzzleText}>New puzzle</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onHome} style={styles.home}>
          <Text style={styles.homeText}>Back to home</Text>
        </Pressable>
      </View>
    </View>
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
  const { cardStyle, shineStyle } = useCardTilt(shineTravel)
  return (
    <Animated.View
      ref={cardRef}
      testID="finish-card"
      style={[styles.card, cardStyle]}
      accessible
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none" />
      {children}
    </Animated.View>
  )
}

function Face({ view, board, iconColor }: { view: FinishView; board: Game; iconColor: string }) {
  return (
    <>
      <View style={styles.top}>
        <Text style={styles.title}>{view.title}</Text>
        {view.newBest && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>New best</Text>
          </View>
        )}
      </View>
      <Text style={styles.time}>{view.time}</Text>
      <CardGrid board={board} />
      <View style={styles.stats}>
        <Stat label="Mistakes" value={view.mistakes} />
        <Stat label="Hints" value={view.hints} />
        <Stat label="Best" value={view.best} />
      </View>
      <View style={styles.footer}>
        {view.fromPaper && <Icon name="scan" tone="text" size={16} color={iconColor} />}
        <Text style={styles.source}>{view.source}</Text>
        <Text style={styles.date}>{view.date}</Text>
      </View>
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
