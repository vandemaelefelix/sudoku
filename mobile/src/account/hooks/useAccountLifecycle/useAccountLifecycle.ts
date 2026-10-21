import { createContext, useContext } from 'react'
import type { AccountLifecycle } from '@/account/accountLifecycle'

/** Null in a build without sync: the account has no lifecycle there, because it has no API to call. */
export const AccountLifecycleContext = createContext<AccountLifecycle | null>(null)

export function useAccountLifecycle(): AccountLifecycle | null {
  return useContext(AccountLifecycleContext)
}
