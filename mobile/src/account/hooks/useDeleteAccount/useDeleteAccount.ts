import { useCallback, useEffect } from 'react'
import type { DeleteOutcome } from '@/account/accountLifecycle'
import { useAccount } from '@/account/hooks/useAccount'
import { useAccountLifecycle } from '@/account/hooks/useAccountLifecycle'
import { useOwner } from '@/storage/hooks/useOwner'

/** Deletes the account of the signed-in player. The order of the steps lives in the account lifecycle (ADR-028). */
export function useDeleteAccount(): () => Promise<DeleteOutcome> {
  const { status } = useAccount()
  const owner = useOwner()
  const lifecycle = useAccountLifecycle()
  // A lost answer counts as a delete only while this screen stays open for this signed-in owner (ADR-028).
  // oxlint-disable-next-line react/exhaustive-effect-dependencies -- owner and status only make the cleanup run on a sign-out.
  useEffect(() => () => lifecycle?.forgetLostAttempt(), [lifecycle, owner, status])
  return useCallback(async () => {
    if (status !== 'signedIn' || owner === null || lifecycle === null) return 'failed'
    return lifecycle.deleteAccount(owner)
  }, [status, owner, lifecycle])
}
