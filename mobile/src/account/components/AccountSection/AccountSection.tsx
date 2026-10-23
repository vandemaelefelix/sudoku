import { getNetworkStateAsync } from 'expo-network'
import { useRef, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useAccount } from '@/account/hooks/useAccount'
import { useIntl } from '@/i18n/hooks/useIntl'
import type { MessageId } from '@/i18n/messages'
import { useAccountLifecycle } from '@/account/hooks/useAccountLifecycle'
import { useDeleteAccount } from '@/account/hooks/useDeleteAccount'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './AccountSection.styles'

type AccountSectionProps = { onSignIn(): void }

/** A token or a call can fail with the network up. Only a network that is down gets the words about the internet. */
async function offlineMessage(): Promise<MessageId> {
  try {
    return (await getNetworkStateAsync()).isConnected === false
      ? 'account.delete.offline'
      : 'account.delete.unreachable'
  } catch {
    return 'account.delete.unreachable'
  }
}

/** The Account section of Settings. A build without a Clerk key has no account, so the section is not there. */
export function AccountSection({ onSignIn }: AccountSectionProps) {
  const { status, email, signOut } = useAccount()
  const intl = useIntl()
  const t = (id: MessageId) => intl.formatMessage({ id })
  const deleteAccount = useDeleteAccount()
  // A build without an API URL has nothing to call, so it has no delete row.
  const canDelete = useAccountLifecycle()?.canDelete === true
  const [deleting, setDeleting] = useState(false)
  // A state update is too late for a second tap in the same frame.
  const busy = useRef(false)
  if (status === 'unconfigured') return null
  const trySignOut = async () => {
    if (!(await signOut())) Alert.alert(t('account.signOut.failedTitle'), t('account.signOut.failedMessage'))
  }
  const confirmSignOut = () =>
    Alert.alert(t('account.signOut.confirmTitle'), t('account.signOut.confirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.section.signOut'), style: 'destructive', onPress: () => void trySignOut() },
    ])
  const runDelete = async () => {
    if (busy.current) return
    busy.current = true
    setDeleting(true)
    try {
      const outcome = await deleteAccount()
      if (outcome === 'offline') Alert.alert(t('account.delete.failedTitle'), t(await offlineMessage()))
      else if (outcome === 'failed') Alert.alert(t('account.delete.failedTitle'), t('account.delete.failed'))
    } finally {
      busy.current = false
      setDeleting(false)
    }
  }
  const confirmDelete = () =>
    Alert.alert(t('account.delete.confirmTitle'), t('account.delete.confirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.delete.action'), style: 'destructive', onPress: () => void runDelete() },
    ])
  return (
    <>
      <View style={styles.section}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('account.section.title')}
          </Text>
          <ThemeDecoration slot="sectionRule" />
        </View>
        {status === 'loading' ? <Text style={styles.hint}>{t('account.section.checking')}</Text> : null}
        {status === 'signedIn' && deleting ? <Text style={styles.hint}>{t('account.delete.pending')}</Text> : null}
        {status === 'signedOut' ? <Text style={styles.hint}>{t('account.section.pitch')}</Text> : null}
      </View>
      {status === 'signedOut' ? (
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={onSignIn}
            style={({ pressed }) => [styles.row, pressed && pressedStyles.pressed]}
          >
            <Text style={styles.action}>{t('account.section.signIn')}</Text>
          </Pressable>
        </View>
      ) : null}
      {status === 'signedIn' ? (
        <View style={styles.card}>
          <View
            style={styles.row}
            accessible
            accessibilityLabel={intl.formatMessage({ id: 'account.section.signedInAs' }, { email })}
          >
            <Text style={styles.email}>{email}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: deleting }}
            disabled={deleting}
            onPress={confirmSignOut}
            style={({ pressed }) => [styles.row, styles.divider, pressed && pressedStyles.pressed]}
          >
            <Text style={styles.action}>{t('account.section.signOut')}</Text>
          </Pressable>
          {canDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('account.delete.hint')}
              accessibilityState={{ disabled: deleting }}
              disabled={deleting}
              onPress={confirmDelete}
              style={({ pressed }) => [styles.row, styles.divider, pressed && pressedStyles.pressed]}
            >
              <Text style={styles.destructiveAction}>{t('account.delete.action')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  )
}
