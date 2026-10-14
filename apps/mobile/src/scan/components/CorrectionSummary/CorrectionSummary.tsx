import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated'
import { Icon } from '@/game/components/Icon'
import { PanelButton } from '@/scan/components/PanelButton'
import { swapInButtons } from '@/scan/utils/swap.utils'
import { pressedStyles } from '@/theme/pressed.styles'
import { easeOut } from '@/utils/motion.utils'
import { STATUS_FADE_MS } from './CorrectionSummary.constants'
import { styles } from './CorrectionSummary.styles'

/** Set for a full grid. phase 'ready': the player has not tapped Check. count: the wrong or clashing cells. */
export type FullGridPanel = {
  phase: 'ready' | 'wrong' | 'clash' | 'solved'
  count: number
  onVerify(): void
  onScanAnother(): void
  onHome(): void
}

type CorrectionSummaryProps = {
  /** The cells that still have a ring. */
  toCheck: number
  /** The givens that share a digit with another given (QR-04). */
  conflictCount: number
  /** The level name of the givens, for example "Hard". */
  level: string
  /** Why Play is off, or null. */
  blockText: string | null
  canPlay: boolean
  /** The buttons rise in after the rest of the panel swap. False during the scan transition and with Reduce Motion. */
  animate: boolean
  /** Solve works only while the play gate is open. */
  canSolve: boolean
  solutionShown: boolean
  onStartCheck(): void
  onPlay?: (() => void) | undefined
  onToggleSolve(): void
  full?: FullGridPanel | null | undefined
}

// A new status crossfades with the old one, and the buttons glide to a new place, so a change of state does not jump.
const STATUS_IN = FadeIn.duration(STATUS_FADE_MS).easing(easeOut).reduceMotion(ReduceMotion.Never)
const STATUS_OUT = FadeOut.duration(STATUS_FADE_MS).easing(easeOut).reduceMotion(ReduceMotion.Never)
const GLIDE = LinearTransition.duration(STATUS_FADE_MS).easing(easeOut)

type Status = 'check' | 'clash' | 'full' | 'ready' | 'blocked'

/** The summary state of the correction panel: what is left to check, the level, Play and Solve. */
export function CorrectionSummary({
  toCheck,
  conflictCount,
  level,
  blockText,
  canPlay,
  animate,
  canSolve,
  solutionShown,
  onStartCheck,
  onPlay,
  onToggleSolve,
  full = null,
}: CorrectionSummaryProps) {
  let status: Status = 'ready'
  if (toCheck > 0) status = 'check'
  else if (conflictCount > 0) status = 'clash'
  else if (full !== null) status = 'full'
  else if (blockText !== null) status = 'blocked'
  const fade = animate ? { entering: STATUS_IN, exiting: STATUS_OUT } : {}
  return (
    <View testID="correction-summary" style={styles.summary}>
      <View style={styles.head}>
        <Animated.View key={full === null ? status : `${status}-${full.phase}`} {...fade} style={styles.statusSlot}>
          {toCheck > 0 ? (
            <Pressable
              testID="start-check"
              accessibilityRole="button"
              accessibilityHint="Opens the first cell to check"
              onPress={onStartCheck}
              style={({ pressed }) => [styles.toCheck, pressed && pressedStyles.pressed]}
            >
              <View style={styles.glyph} />
              <Text
                style={[styles.status, styles.statusWarning]}
              >{`${toCheck} ${toCheck === 1 ? 'cell' : 'cells'} to check`}</Text>
              <Icon name="next" tone="warningText" size={16} />
            </Pressable>
          ) : conflictCount > 0 ? (
            <Text style={[styles.status, styles.statusDanger]}>{`${conflictCount} givens clash`}</Text>
          ) : full !== null ? (
            <FullStatus phase={full.phase} count={full.count} />
          ) : (
            <Text style={styles.status}>{blockText === null ? 'Ready to play' : 'Check the givens'}</Text>
          )}
        </Animated.View>
        {full === null && (
          <Text testID="correction-level" style={styles.level}>
            {level}
          </Text>
        )}
      </View>
      {blockText !== null && (
        <Animated.Text testID="play-blocked" {...fade} style={styles.blocked}>
          {blockText}
        </Animated.Text>
      )}
      {full !== null ? (
        full.phase === 'wrong' || full.phase === 'clash' ? null : (
          <Animated.View {...(animate ? { entering: swapInButtons, layout: GLIDE } : {})} style={styles.buttons}>
            {full.phase === 'ready' ? (
              <PanelButton
                testID="verify"
                label="Check"
                kind="primary"
                grow
                disabled={conflictCount > 0}
                onPress={full.onVerify}
              />
            ) : (
              <>
                <PanelButton
                  testID="scan-another"
                  label="Scan another"
                  kind="primary"
                  grow
                  onPress={full.onScanAnother}
                />
                <PanelButton testID="home" label="Home" kind="second" onPress={full.onHome} />
              </>
            )}
          </Animated.View>
        )
      ) : (
        <Animated.View {...(animate ? { entering: swapInButtons, layout: GLIDE } : {})} style={styles.buttons}>
          <PanelButton
            testID="play"
            label="Play this puzzle"
            kind="primary"
            grow
            disabled={!canPlay}
            accessibilityHint={blockText ?? undefined}
            onPress={onPlay}
          />
          <PanelButton
            testID="solve"
            label={solutionShown ? 'Hide' : 'Solve'}
            kind="second"
            disabled={!canSolve}
            pressed={solutionShown}
            animateLabel={animate}
            onPress={onToggleSolve}
          />
        </Animated.View>
      )}
    </View>
  )
}

function FullStatus({ phase, count }: { phase: FullGridPanel['phase']; count: number }) {
  if (phase === 'solved') return null
  if (phase === 'ready') return <Text style={styles.status}>Grid is full</Text>
  const text = phase === 'wrong' ? `${count} ${count === 1 ? 'cell differs' : 'cells differ'}` : `${count} cells clash`
  return (
    <View style={styles.differ}>
      {phase === 'wrong' && <View testID="differ-sample" style={styles.sample} />}
      <Text style={[styles.status, styles.statusDanger]}>{text}</Text>
    </View>
  )
}
