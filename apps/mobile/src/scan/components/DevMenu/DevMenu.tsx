import { Modal, Pressable, Switch, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { withUnistyles } from 'react-native-unistyles'
import type { RecogniseResult } from '@/scanner'
import { Icon } from '@/game/components/Icon'
import { PanelButton } from '@/scan/components/PanelButton'
import { ScanInspector, ScanTabs } from '@/scan/components/ScanInspector'
import { ThresholdSlider } from '@/scan/components/ThresholdSlider'
import { THRESHOLD_RANGE } from '@/scan/constants/correction.constants'
import type { InspectorView } from '@/scan/utils/inspector.utils'
import { SAVE_TEXT, SHEET_PADDING, VIEWER_HEIGHT, type SaveState } from './DevMenu.constants'
import { styles } from './DevMenu.styles'

// No thumbColor: on iOS a thumb colour removes the shadow of the thumb.
const ThemedSwitch = withUnistyles(Switch, (theme) => ({
  trackColor: { false: theme.components.switch.off, true: theme.components.switch.on },
  ios_backgroundColor: theme.components.switch.off,
}))

type OkResult = Extract<RecogniseResult, { ok: true }>

type DevMenuProps = {
  visible: boolean
  onClose(): void
  result: OkResult
  view: InspectorView
  onView(view: InspectorView): void
  labelKinds: boolean
  onLabelKinds(on: boolean): void
  showConfidence: boolean
  onShowConfidence(on: boolean): void
  /** The ring threshold. It changes the rings at once and is not saved. */
  threshold: number
  onThreshold(value: number): void
  saveState: SaveState
  /** Saves the scan with the corrections on the phone (SUD-02). Without it, the sheet shows no Save button. */
  onSave?: (() => void) | undefined
}

function SwitchRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string
  sub: string
  value: boolean
  onChange(on: boolean): void
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <ThemedSwitch
        testID={`switch-${label}`}
        accessibilityLabel={label}
        accessibilityHint={sub}
        value={value}
        onValueChange={onChange}
      />
    </View>
  )
}

/** The dev menu of the correction screen. Development builds only: the screen renders it only under __DEV__. */
export function DevMenu({
  visible,
  onClose,
  result,
  view,
  onView,
  labelKinds,
  onLabelKinds,
  showConfidence,
  onShowConfidence,
  threshold,
  onThreshold,
  saveState,
  onSave,
}: DevMenuProps) {
  const { width } = useWindowDimensions()
  const { bottom } = useSafeAreaInsets()
  const busy = saveState === 'saving' || saveState === 'saved'
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close the developer menu" onPress={onClose} style={styles.dismiss} />
        <View
          testID="dev-menu"
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: bottom + SHEET_PADDING }]}
        >
          <View style={styles.head}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Developer</Text>
              <Text style={styles.note}>Dev build only</Text>
            </View>
            <Pressable
              testID="dev-close"
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.close}
            >
              <Icon name="close" tone="textMuted" />
            </Pressable>
          </View>
          <ScanTabs view={view} onChange={onView} />
          <View style={styles.viewer}>
            <ScanInspector
              view={view}
              result={result}
              threshold={threshold}
              region={{ x: 0, y: 0, width: width - 2 * SHEET_PADDING, height: VIEWER_HEIGHT }}
            />
          </View>
          <View>
            <SwitchRow
              label="Label kinds"
              sub="Set printed, handwritten, notes or empty on a cell"
              value={labelKinds}
              onChange={onLabelKinds}
            />
            <SwitchRow
              label="Show confidence"
              sub="Show the kind and the confidence in each cell"
              value={showConfidence}
              onChange={onShowConfidence}
            />
          </View>
          <ThresholdSlider
            label="Ring threshold"
            value={threshold}
            min={THRESHOLD_RANGE.min}
            max={THRESHOLD_RANGE.max}
            onChange={onThreshold}
          />
          {onSave && (
            <>
              <PanelButton testID="save" label={SAVE_TEXT[saveState]} kind="primary" disabled={busy} onPress={onSave} />
              <Text style={styles.caption}>
                Saves the photo, the 81 cells and the labels on this phone. Nothing leaves the device.
              </Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}
