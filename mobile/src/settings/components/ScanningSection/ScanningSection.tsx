import { Linking, Pressable, Text, View } from 'react-native'
import { AssistRow } from '@/settings/components/AssistRow'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { POLICY_LINK_LABEL, POLICY_URL, SHARE_ROW } from '@/scanShare/constants/scanShare.constants'
import { useScanShare } from '@/scanShare/useScanShare'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './ScanningSection.styles'

/** The Scanning section of Settings (ADR-030): the "Help improve the app" switch and the link to the privacy policy. */
export function ScanningSection() {
  const { on, setOn } = useScanShare()
  const haptics = useHaptics()
  return (
    <>
      <View style={styles.section}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Scanning
          </Text>
          <ThemeDecoration slot="sectionRule" />
        </View>
      </View>
      <View testID="scanning-card" style={styles.card}>
        <AssistRow
          label={SHARE_ROW.label}
          description={SHARE_ROW.description}
          value={on}
          divider={false}
          onChange={(next) => {
            haptics.play('tick')
            setOn(next)
          }}
        />
        <View style={styles.linkRow}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={POLICY_LINK_LABEL}
            onPress={() => void Linking.openURL(POLICY_URL).catch(() => undefined)}
            style={({ pressed }) => pressed && pressedStyles.pressed}
          >
            <Text style={styles.link}>{POLICY_LINK_LABEL}</Text>
          </Pressable>
        </View>
      </View>
    </>
  )
}
