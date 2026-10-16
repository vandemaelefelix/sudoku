import { getNetworkStateAsync } from 'expo-network'
import { useRef, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import {
  DELETE_CONFIRM_ACTION,
  DELETE_CONFIRM_MESSAGE,
  DELETE_CONFIRM_TITLE,
  DELETE_FAILED_MESSAGE,
  DELETE_FAILED_TITLE,
  DELETE_HINT,
  DELETE_OFFLINE_MESSAGE,
  DELETE_PENDING_HINT,
  DELETE_UNREACHABLE_MESSAGE,
} from '@/account/constants/account.constants'
import { useAccount } from '@/account/hooks/useAccount'
import { useDeleteAccount } from '@/account/hooks/useDeleteAccount'
import { useSyncControl } from '@/sync/hooks/useSyncControl'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './AccountSection.styles'

type AccountSectionProps = { onSignIn(): void }

/** The Account section of Settings. A build without a Clerk key has no account, so the section is not there. */
/** A token or a call can fail with the network up. Only a network that is down gets the words about the internet. */
async function offlineMessage(): Promise<string> {
  try {
    return (await getNetworkStateAsync()).isConnected === false ? DELETE_OFFLINE_MESSAGE : DELETE_UNREACHABLE_MESSAGE
  } catch {
    return DELETE_UNREACHABLE_MESSAGE
  }
}

export function AccountSection({ onSignIn }: AccountSectionProps) {
  const { status, email, signOut } = useAccount()
  const deleteAccount = useDeleteAccount()
  // A build without an API URL has nothing to call, so it has no delete row.
  const canDelete = useSyncControl() !== null
  const [deleting, setDeleting] = useState(false)
  // A state update is too late for a second tap in the same frame.
  const busy = useRef(false)
  if (status === 'unconfigured') return null
  const trySignOut = async () => {
    if (!(await signOut())) Alert.alert('Could not sign out', 'Check your connection and try again.')
  }
  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'The games of this account stay on this iPhone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void trySignOut() },
    ])
  const runDelete = async () => {
    if (busy.current) return
    busy.current = true
    setDeleting(true)
    try {
      const outcome = await deleteAccount()
      if (outcome === 'offline') Alert.alert(DELETE_FAILED_TITLE, await offlineMessage())
      else if (outcome === 'failed') Alert.alert(DELETE_FAILED_TITLE, DELETE_FAILED_MESSAGE)
    } finally {
      busy.current = false
      setDeleting(false)
    }
  }
  const confirmDelete = () =>
    Alert.alert(DELETE_CONFIRM_TITLE, DELETE_CONFIRM_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      { text: DELETE_CONFIRM_ACTION, style: 'destructive', onPress: () => void runDelete() },
    ])
  return (
    <>
      <View style={styles.section}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Account
          </Text>
          <ThemeDecoration slot="sectionRule" />
        </View>
        {status === 'loading' ? <Text style={styles.hint}>Checking the account…</Text> : null}
        {status === 'signedIn' && deleting ? <Text style={styles.hint}>{DELETE_PENDING_HINT}</Text> : null}
        {status === 'signedOut' ? <Text style={styles.hint}>Back up your games across devices.</Text> : null}
      </View>
      {status === 'signedOut' ? (
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={onSignIn}
            style={({ pressed }) => [styles.row, pressed && pressedStyles.pressed]}
          >
            <Text style={styles.action}>Sign in</Text>
          </Pressable>
        </View>
      ) : null}
      {status === 'signedIn' ? (
        <View style={styles.card}>
          <View style={styles.row} accessible accessibilityLabel={`Signed in as ${email}`}>
            <Text style={styles.email}>{email}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: deleting }}
            disabled={deleting}
            onPress={confirmSignOut}
            style={({ pressed }) => [styles.row, styles.divider, pressed && pressedStyles.pressed]}
          >
            <Text style={styles.action}>Sign out</Text>
          </Pressable>
          {canDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={DELETE_HINT}
              accessibilityState={{ disabled: deleting }}
              disabled={deleting}
              onPress={confirmDelete}
              style={({ pressed }) => [styles.row, styles.divider, pressed && pressedStyles.pressed]}
            >
              <Text style={styles.destructiveAction}>{DELETE_CONFIRM_ACTION}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  )
}
