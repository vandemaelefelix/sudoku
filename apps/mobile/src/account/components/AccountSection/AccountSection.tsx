import { Alert, Pressable, Text, View } from 'react-native'
import { useAccount } from '@/account/hooks/useAccount'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './AccountSection.styles'

type AccountSectionProps = { onSignIn(): void }

/** The Account section of Settings. A build without a Clerk key has no account, so the section is not there. */
export function AccountSection({ onSignIn }: AccountSectionProps) {
  const { status, email, signOut } = useAccount()
  if (status === 'unconfigured') return null
  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'The games of this account stay on this iPhone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
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
          <View style={styles.row}>
            <Text style={styles.email}>{email}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={confirmSignOut}
            style={({ pressed }) => [styles.row, styles.divider, pressed && pressedStyles.pressed]}
          >
            <Text style={styles.action}>Sign out</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  )
}
