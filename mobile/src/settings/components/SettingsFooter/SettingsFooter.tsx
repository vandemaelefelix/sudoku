import { Text, View } from 'react-native'
import { shortId, versionLabel } from '@/scanShare/scanConfig'
import { useContributorId } from '@/scanShare/useScanShare'
import { styles } from './SettingsFooter.styles'

/** The app version and the short contributor ID. A player who wants the scans deleted sends the ID (ADR-030). */
export function SettingsFooter() {
  const id = useContributorId()
  return (
    <View testID="settings-footer" style={styles.footer}>
      <Text style={styles.text}>{`Version ${versionLabel()}`}</Text>
      {id !== null && <Text style={styles.text}>{`ID ${shortId(id)}`}</Text>}
    </View>
  )
}
