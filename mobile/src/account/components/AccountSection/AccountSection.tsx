import { getNetworkStateAsync } from 'expo-network'
import { useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useAccount } from '@/account/hooks/useAccount'
import { CardRow } from '@/components/CardRow'
import { FramedCard } from '@/components/FramedCard'
import { SectionHeading } from '@/components/SectionHeading'
import { useIntl } from '@/i18n/hooks/useIntl'
import type { MessageId } from '@/i18n/messages'
import { useAccountLifecycle } from '@/account/hooks/useAccountLifecycle'
import { useDeleteAccount } from '@/account/hooks/useDeleteAccount'

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
  const hint =
    status === 'loading'
      ? t('account.section.checking')
      : status === 'signedIn' && deleting
        ? t('account.delete.pending')
        : status === 'signedOut'
          ? t('account.section.pitch')
          : undefined
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
      <SectionHeading title={t('account.section.title')} hint={hint} />
      {status === 'signedOut' ? (
        <FramedCard>
          <CardRow label={t('account.section.signIn')} onPress={onSignIn} />
        </FramedCard>
      ) : null}
      {status === 'signedIn' ? (
        <FramedCard>
          <CardRow
            label={email ?? ''}
            tone="quiet"
            accessibilityLabel={intl.formatMessage({ id: 'account.section.signedInAs' }, { email })}
          />
          <CardRow label={t('account.section.signOut')} disabled={deleting} onPress={confirmSignOut} />
          {canDelete ? (
            <CardRow
              label={t('account.delete.action')}
              tone="danger"
              accessibilityHint={t('account.delete.hint')}
              disabled={deleting}
              onPress={confirmDelete}
            />
          ) : null}
        </FramedCard>
      ) : null}
    </>
  )
}
