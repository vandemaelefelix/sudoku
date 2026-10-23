import { Linking, Pressable, Text, View } from 'react-native'
import { FramedCard } from '@/components/FramedCard'
import { SectionHeading } from '@/components/SectionHeading'
import { AssistRow } from '@/settings/components/AssistRow'
import { useHaptics } from '@/preferences/hooks/useHaptics'
import { useIntl } from '@/i18n/hooks/useIntl'
import { POLICY_URL } from '@/scanShare/constants/scanShare.constants'
import { useScanShare } from '@/scanShare/useScanShare'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './ScanningSection.styles'

/** The Scanning section of Settings (ADR-030): the "Help improve the app" switch and the link to the privacy policy. */
export function ScanningSection() {
  const { on, setOn } = useScanShare()
  const haptics = useHaptics()
  const intl = useIntl()
  const policy = intl.formatMessage({ id: 'scanShare.policy' })
  return (
    <>
      <SectionHeading title={intl.formatMessage({ id: 'settings.scanning.title' })} />
      <FramedCard testID="scanning-card">
        <AssistRow
          label={intl.formatMessage({ id: 'scanShare.title' })}
          description={intl.formatMessage({ id: 'scanShare.description' })}
          value={on}
          onChange={(next) => {
            haptics.play('tick')
            setOn(next)
          }}
        />
        <View style={styles.linkRow}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={policy}
            onPress={() => void Linking.openURL(POLICY_URL).catch(() => undefined)}
            style={({ pressed }) => pressed && pressedStyles.pressed}
          >
            <Text style={styles.link}>{policy}</Text>
          </Pressable>
        </View>
      </FramedCard>
    </>
  )
}
