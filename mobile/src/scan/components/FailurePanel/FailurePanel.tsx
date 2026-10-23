import { Text, View } from 'react-native'
import { PanelButton } from '@/components/PanelButton'
import { useIntl } from '@/i18n/hooks/useIntl'
import { failureCopy } from '@/scan/utils/failureCopy.utils'
import { styles } from './FailurePanel.styles'

type FailurePanelProps = {
  /** The reason of the failed scan. */
  failure: string | null
  /** The panel offers another image, not the camera. */
  importFailed: boolean
  onChooseImage(): void
  onRetake(): void
}

/** The panel of a failed scan: what went wrong and one button to try again. */
export function FailurePanel({ failure, importFailed, onChooseImage, onRetake }: FailurePanelProps) {
  const intl = useIntl()
  const copy = failureCopy(failure, importFailed)
  return (
    <View testID="correction-failure" style={styles.failure}>
      <Text style={styles.failureTitle}>{intl.formatMessage({ id: copy.title })}</Text>
      <Text style={styles.failureReason}>{intl.formatMessage({ id: copy.reason })}</Text>
      {importFailed ? (
        <PanelButton
          testID="choose-another"
          label={intl.formatMessage({ id: 'scan.failure.chooseAnother' })}
          kind="primary"
          onPress={onChooseImage}
        />
      ) : (
        <PanelButton
          testID="retake-failure"
          label={intl.formatMessage({ id: 'scan.correction.retake' })}
          kind="primary"
          onPress={onRetake}
        />
      )}
    </View>
  )
}
