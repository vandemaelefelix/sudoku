import { useCallback, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, Text, View } from 'react-native'
import Animated, { useReducedMotion } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import type { Game } from '@sudoku/core'
import { GLARE_REST, SHINE_TRAVEL } from '@/game/constants/tilt.constants'
import { useGameState } from '@/game/hooks/useGameState'
import { useLeave, type LeaveCallback } from '@/game/hooks/useLeave'
import { useGameTime } from '@/game/hooks/useGameTime'
import { useSheetRise } from '@/game/hooks/useSheetRise'
import { useSolveDelay } from '@/game/hooks/useSolveDelay'
import { useHaptics } from '@/preferences/hooks/useHaptics'
import { finishView, type FinishInfo } from '@/game/utils/finish.utils'
import { useIntl } from '@/i18n/hooks/useIntl'
import { riseIn } from '@/utils/motion.utils'
import { pressedStyles } from '@/theme/pressed.styles'
import { FACE_DELAY_MS, FACE_RISE, FACE_STAGGER_MS, FINISH_RISE_OFFSET } from './FinishCard.constants'
import { Face } from './Face'
import { styles } from './FinishCard.styles'
import { TiltingCard } from './TiltingCard'

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
  const intl = useIntl()
  const view = finishView(intl, board, playedMs, info, finishedAt)
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  const card = useRef<View>(null)
  const { play } = useHaptics()
  const newBest = view.newBest
  // The scrim hides the grid, but VoiceOver focus stays on the key that won the game.
  // A new best lands with a thud: the solve already played its success haptic.
  // The card lands once. A change of Reduce Motion while it shows must not focus it or thud again.
  const hasLanded = useRef(false)
  // landed keeps its identity: the result of a won game does not change, so the rise runs once.
  const landed = useCallback(() => {
    if (hasLanded.current) return
    hasLanded.current = true
    if (card.current) AccessibilityInfo.sendAccessibilityEvent(card.current, 'focus')
    if (newBest) play('thud')
  }, [newBest, play])
  const { rise, fadeStyle, riseStyle } = useSheetRise(landed, FINISH_RISE_OFFSET)
  // The sheet sinks before the new game shows. The game-screen route takes Back to home away.
  const { leaveThen, guard } = useLeave(rise)
  // With Reduce Motion the parts only fade.
  const faceRise = reduceMotion ? 0 : FACE_RISE
  const partIn = (part: number) => riseIn(FACE_DELAY_MS + part * FACE_STAGGER_MS, faceRise, theme.motion.medium)
  // The buttons fade in after the card lands, so the eye reads the result first.
  const actionsIn = riseIn(theme.motion.medium, 0, theme.motion.short)
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
            <Text style={styles.newPuzzleText}>{intl.formatMessage({ id: 'game.newPuzzle' })}</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => guard(onHome)}
          style={({ pressed }) => [styles.home, pressed && pressedStyles.pressed]}
        >
          <Text style={styles.homeText}>{intl.formatMessage({ id: 'common.backHome' })}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}
