import { Pressable, Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { PanelButton } from '@/scan/components/PanelButton'
import { styles } from './CorrectionSummary.styles'

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
  /** Solve works only while the play gate is open. */
  canSolve: boolean
  solutionShown: boolean
  onStartCheck(): void
  onPlay?: (() => void) | undefined
  onToggleSolve(): void
}

/** The summary state of the correction panel: what is left to check, the level, Play and Solve. */
export function CorrectionSummary({
  toCheck,
  conflictCount,
  level,
  blockText,
  canPlay,
  canSolve,
  solutionShown,
  onStartCheck,
  onPlay,
  onToggleSolve,
}: CorrectionSummaryProps) {
  return (
    <View testID="correction-summary" style={styles.summary}>
      <View style={styles.head}>
        {toCheck > 0 ? (
          <Pressable
            testID="start-check"
            accessibilityRole="button"
            accessibilityHint="Opens the first cell to check"
            onPress={onStartCheck}
            style={styles.toCheck}
          >
            <View style={styles.glyph} />
            <Text
              style={[styles.status, styles.statusWarning]}
            >{`${toCheck} ${toCheck === 1 ? 'cell' : 'cells'} to check`}</Text>
            <Icon name="next" tone="warningText" size={16} />
          </Pressable>
        ) : conflictCount > 0 ? (
          <Text style={[styles.status, styles.statusDanger]}>{`${conflictCount} givens clash`}</Text>
        ) : (
          <Text style={styles.status}>{blockText === null ? 'Ready to play' : 'Check the givens'}</Text>
        )}
        <Text testID="correction-level" style={styles.level}>
          {level}
        </Text>
      </View>
      {blockText !== null && (
        <Text testID="play-blocked" style={styles.blocked}>
          {blockText}
        </Text>
      )}
      <View style={styles.buttons}>
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
          onPress={onToggleSolve}
        />
      </View>
    </View>
  )
}
