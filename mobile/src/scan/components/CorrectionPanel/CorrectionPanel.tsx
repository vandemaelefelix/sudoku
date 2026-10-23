import { View } from 'react-native'
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LEVEL_LABELS } from '@/constants/level.constants'
import { useIntl } from '@/i18n/hooks/useIntl'
import { CorrectionCheck } from '@/scan/components/CorrectionCheck'
import { CorrectionSummary } from '@/scan/components/CorrectionSummary'
import { FailurePanel } from '@/scan/components/FailurePanel'
import { PANEL_PADDING } from '@/scan/constants/correction.constants'
import { SWAP_OUT_MS } from '@/scan/constants/swap.constants'
import type { useCorrectionMotion } from '@/scan/hooks/useCorrectionMotion'
import type { CorrectionSession } from '@/scan/hooks/useCorrectionSession'
import type { CorrectionLayout } from '@/scan/utils/correction.utils'
import { swapIn } from '@/scan/utils/swap.utils'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { easeOut } from '@/utils/motion.utils'
import { PANEL_RESIZE_MS, PLAY_BLOCK_TEXT } from './CorrectionPanel.constants'
import { styles } from './CorrectionPanel.styles'

// The old content fades out while the new content rises in, so a change of state reads as one motion.
const SWAP_OUT = FadeOut.duration(SWAP_OUT_MS).easing(easeOut)
const PANEL_RESIZE = LinearTransition.duration(PANEL_RESIZE_MS).easing(easeOut)

type CorrectionPanelProps = {
  /** The session of the screen. The panel shows its state: failure, summary, check or pick. */
  session: CorrectionSession
  layout: CorrectionLayout
  style: ReturnType<typeof useCorrectionMotion>['panelStyle']
  /** The state changes of the panel play their swap and resize. */
  motion: boolean
  /** The transition runs: the panel plays no swap, and the buttons do not rise in. */
  transitioning: boolean
  /** The dev menu labels the kind of the open cell. */
  labelKinds: boolean
  /** The panel offers another image, not the camera. */
  importFailed: boolean
  onHome?: (() => void) | undefined
}

/** The bottom panel: the failure, the summary or the check of one cell. */
export function CorrectionPanel({
  session,
  layout,
  style,
  motion,
  transitioning,
  labelKinds,
  importFailed,
  onHome,
}: CorrectionPanelProps) {
  const intl = useIntl()
  const { bottom } = useSafeAreaInsets()
  const { actions, openCell, picking, play, looks } = session
  const { panel, panelInset } = layout
  const blockId = play.block === null ? null : PLAY_BLOCK_TEXT[play.block]
  const full = session.fullGrid && {
    ...session.fullGrid,
    onVerify: actions.verify,
    onScanAnother: actions.scanAnother,
    onHome,
  }
  return (
    <Animated.View
      testID="correction-panel"
      // The keypad makes the panel taller. The panel grows to it instead of jumping.
      {...(motion ? { layout: PANEL_RESIZE } : {})}
      style={[styles.panel, { left: panel.x, width: panel.width, minHeight: panel.height }, style]}
    >
      {!(openCell && picking) && <ThemeDecoration slot="panelEdge" />}
      <View
        style={[
          styles.panelBody,
          {
            padding: PANEL_PADDING,
            paddingHorizontal: PANEL_PADDING + panelInset,
            paddingTop: PANEL_PADDING - 4,
            paddingBottom: bottom + PANEL_PADDING,
          },
        ]}
      >
        <Animated.View
          // A new key mounts new content, so each state change plays the swap. The next cell keeps the key:
          // the panel stays and CorrectionCheck moves its content to the new cell.
          key={session.panel}
          {...(transitioning || !motion ? {} : { entering: swapIn, exiting: SWAP_OUT })}
        >
          {session.panel === 'failure' ? (
            <FailurePanel
              failure={session.failure}
              importFailed={importFailed}
              onChooseImage={actions.chooseImage}
              onRetake={actions.retake}
            />
          ) : openCell !== null && session.panel !== 'summary' ? (
            <CorrectionCheck
              cell={openCell.cell}
              look={openCell.look}
              looks={looks}
              flow={session.flow}
              picking={picking}
              image={session.image}
              hint={session.hint}
              labelKinds={labelKinds}
              animate={motion}
              onClose={actions.close}
              onYes={actions.yes}
              onNo={actions.no}
              onDigit={actions.setDigit}
              onClear={actions.clear}
              onKind={actions.setKind}
            />
          ) : (
            <CorrectionSummary
              toCheck={session.toCheck}
              conflictCount={session.conflictCount}
              level={play.level === null ? '' : intl.formatMessage({ id: LEVEL_LABELS[play.level] })}
              blockText={blockId === null ? null : intl.formatMessage({ id: blockId })}
              canPlay={play.canPlay}
              animate={!transitioning && motion}
              canSolve={play.canSolve}
              solutionShown={play.solution !== null}
              full={full}
              onStartCheck={actions.startCheck}
              onPlay={play.canPlay ? actions.play : undefined}
              onToggleSolve={actions.toggleSolution}
            />
          )}
        </Animated.View>
      </View>
    </Animated.View>
  )
}
