import { Canvas, Picture } from '@shopify/react-native-skia'
import { ActivityIndicator, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { useIntl } from '@/i18n/hooks/useIntl'
import { CorrectionBar } from '@/scan/components/CorrectionBar'
import { CorrectionCell } from '@/scan/components/CorrectionCell'
import { CorrectionPanel } from '@/scan/components/CorrectionPanel'
import { CorrectionTile } from '@/scan/components/CorrectionTile'
import { DevMenu } from '@/scan/components/DevMenu'
import type { CaptureSession } from '@/scan/hooks/useCaptureSession'
import { useCorrectionBoard } from '@/scan/hooks/useCorrectionBoard'
import { useCorrectionMotion } from '@/scan/hooks/useCorrectionMotion'
import { type CorrectionExits, useCorrectionSession } from '@/scan/hooks/useCorrectionSession'
import { useDevOverlay } from '@/scan/hooks/useDevOverlay'
import { useDigitSizes } from '@/scan/hooks/useDigitSizes'
import type { CorrectionLayout } from '@/scan/utils/correction.utils'
import { cellRect } from '@/utils/grid.utils'
import { styles } from './CorrectionScreen.styles'

export type CorrectionProps = CorrectionExits & {
  /**
   * The capture session. In the capturing phase the clock drives every layer and the results may be null. In the review phase
   * everything shows and the player can edit.
   */
  session: Pick<CaptureSession, 'phase' | 'origin' | 'result' | 'crossFade' | 'clock' | 'waiting' | 'resultsAt'>
  layout: CorrectionLayout
}

export function CorrectionScreen({ session: capture, layout, ...exits }: CorrectionProps) {
  const { theme } = useUnistyles()
  const intl = useIntl()
  const correction = useCorrectionSession(capture, exits)
  const { actions, editable, looks, openCell, timing, dev } = correction
  const { grid } = layout
  const cellSize = grid.width / 9
  const digitSizes = useDigitSizes(cellSize)
  const { board, lines } = useCorrectionBoard(grid.width)
  const overlay = useDevOverlay({ editable, scan: dev.scan, looks, threshold: dev.threshold })
  const failed = correction.panel === 'failure'
  // The transition clock exists until the review. In the review, every layer shows and nothing waits.
  const waiting = capture.phase === 'review' ? undefined : capture.waiting
  const { motion, titleStyle, panelStyle, waitingStyle } = useCorrectionMotion({
    timing,
    waiting,
    failed,
    panelHeight: layout.panel.height,
  })
  const open = openCell?.cell ?? null
  const transitioning = timing.clock !== undefined
  // The tile of the open cell. An uncertain cell keeps its own ring and fill instead. During the transition no cell is
  // open, and the tile stays away so it never slides with the grid.
  const tile =
    transitioning || open === null || looks[open]?.uncertain !== false
      ? null
      : { ...cellRect(grid, cellSize, open), size: cellSize }
  const gridBox = { position: 'absolute', left: grid.x, top: grid.y, width: grid.width, height: grid.height } as const
  // The board and the lines mount with the transition and stay hidden under it. A new Skia canvas is blank until a later
  // display frame, so a canvas that mounted at the end of the transition would blink.
  const boardBox = [gridBox, { opacity: transitioning ? 0 : 1 }]

  return (
    <View testID="correction-screen" style={[styles.screen, !transitioning && styles.screenFilled]}>
      <Canvas testID="correction-board" style={boardBox}>
        <Picture picture={board} />
      </Canvas>
      <CorrectionBar
        bar={layout.bar}
        title={layout.title}
        heading={intl.formatMessage({ id: correction.solved ? 'scan.correction.solved' : 'scan.correction.title' })}
        titleStyle={titleStyle}
        interactive={correction.panel !== null}
        onRetake={actions.retake}
        onOpenDev={overlay.devTools ? () => overlay.setOpen(true) : undefined}
      />
      <CorrectionTile rect={tile} />
      {looks.map((look, n) => {
        const { left, top } = cellRect(grid, cellSize, n)
        return (
          <CorrectionCell
            // oxlint-disable-next-line react/no-array-index-key -- the index is the cell position, a fixed identity of 81 cells
            key={n}
            n={n}
            look={look}
            size={cellSize}
            digitSizes={digitSizes}
            left={left}
            top={top}
            selected={open === n}
            conflict={correction.conflictCells.has(n)}
            hint={String(correction.hints[n] ?? '')}
            pulse={correction.celebrated ? correction.pulse : undefined}
            solution={
              correction.play.solution === null || look.digit !== '' ? '' : String(correction.play.solution[n] ?? '')
            }
            confidence={overlay.confidences?.[n] ?? null}
            onSelect={editable ? actions.select : undefined}
            timing={timing}
          />
        )
      })}
      <Canvas testID="correction-lines" pointerEvents="none" style={boardBox}>
        <Picture picture={lines} />
      </Canvas>
      {correction.panel === null && waiting && (
        <Animated.View
          testID="correction-waiting"
          pointerEvents="none"
          style={[styles.waiting, { left: grid.x, top: grid.y, width: grid.width, height: grid.height }, waitingStyle]}
        >
          <ActivityIndicator color={theme.colors.textMuted} />
        </Animated.View>
      )}
      {correction.panel !== null && (
        <CorrectionPanel
          session={correction}
          layout={layout}
          style={panelStyle}
          motion={motion}
          transitioning={transitioning}
          labelKinds={overlay.devTools && overlay.labelKinds}
          // A failed import offers another image, not the camera.
          importFailed={failed && capture.origin === 'library' && exits.onChooseImage !== undefined}
          onHome={exits.onHome}
        />
      )}
      {overlay.devTools && dev.scan !== null && (
        <DevMenu
          visible={overlay.open}
          onClose={() => overlay.setOpen(false)}
          result={dev.scan}
          view={overlay.view}
          onView={overlay.setView}
          labelKinds={overlay.labelKinds}
          onLabelKinds={overlay.setLabelKinds}
          showConfidence={overlay.showConfidence}
          onShowConfidence={overlay.setShowConfidence}
          threshold={dev.threshold}
          onThreshold={dev.setThreshold}
          saveState={dev.saveState}
          onSave={dev.canSave ? actions.save : undefined}
        />
      )}
    </View>
  )
}
