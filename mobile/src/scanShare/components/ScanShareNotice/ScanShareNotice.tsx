import { Linking, Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PanelButton } from '@/scan/components/PanelButton'
import { NOTICE, POLICY_LINK_LABEL, POLICY_URL } from '@/scanShare/constants/scanShare.constants'
import { useScanShare } from '@/scanShare/useScanShare'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './ScanShareNotice.styles'

/**
 * The first-upload notice (ADR-030). It opens once, after the first scan leaves the correction screen and before anything uploads.
 * It lives in the root layout, because the correction screen is gone by then. Both buttons close it for good.
 */
export function ScanShareNotice() {
  const { noticeDue, acceptNotice, declineNotice } = useScanShare()
  const { bottom } = useSafeAreaInsets()
  return (
    <Modal visible={noticeDue} transparent animationType="slide" onRequestClose={acceptNotice}>
      <View style={styles.backdrop}>
        <View
          testID="scan-share-notice"
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: bottom + 20 }]}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {NOTICE.title}
          </Text>
          <Text style={styles.body}>{NOTICE.body}</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={POLICY_LINK_LABEL}
            onPress={() => void Linking.openURL(POLICY_URL).catch(() => undefined)}
            style={({ pressed }) => pressed && pressedStyles.pressed}
          >
            <Text style={styles.link}>{POLICY_LINK_LABEL}</Text>
          </Pressable>
          <PanelButton testID="notice-accept" label={NOTICE.accept} kind="primary" onPress={acceptNotice} />
          <Pressable
            testID="notice-decline"
            accessibilityRole="button"
            onPress={declineNotice}
            style={({ pressed }) => [styles.linkTarget, pressed && pressedStyles.pressed]}
          >
            <Text style={styles.link}>{NOTICE.decline}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
