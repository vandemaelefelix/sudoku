import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { useAccount } from '@/account/hooks/useAccount'
import { useIntl } from '@/i18n/hooks/useIntl'
import { REFRESH_SYNCED_LINE_MS } from '@/sync/constants/sync.constants'
import { useSync } from '@/sync/hooks/useSync'
import { formatSyncedAgo } from '@/sync/utils/syncedAgo.utils'
import { styles } from './SyncedLine.styles'

/** One muted line, only for a signed-in player after a first sync. It shows no spinner and no error (ADR-028). */
export function SyncedLine() {
  const { status } = useAccount()
  const { lastSyncedAt } = useSync()
  const intl = useIntl()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_SYNCED_LINE_MS)
    return () => clearInterval(timer)
  }, [])
  if (status !== 'signedIn' || lastSyncedAt === null) return null
  return <Text style={styles.note}>{formatSyncedAgo(intl, lastSyncedAt, now)}</Text>
}
