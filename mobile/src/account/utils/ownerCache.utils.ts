import * as SecureStore from 'expo-secure-store'
import { OWNER_CACHE_KEY, PENDING_SIGN_OUT_KEY } from '@/account/constants/account.constants'
import { devWarn, errorMessage } from '@/utils/log.utils'

/** The Keychain items of the account. Every method never rejects, so the Keychain never stops the play (SUD-01). */
export type OwnerCache = {
  /** The cached Clerk user ID. A failed read gives null. */
  read(): Promise<string | null>
  /** Stores the owner, or clears the cache for null. A failed write is not fatal: the next start asks Clerk again. */
  write(owner: string | null): Promise<void>
  /** True when a deleted account is still signed in at Clerk. A failed read gives false. */
  pendingSignOut(): Promise<boolean>
  setPendingSignOut(pending: boolean): Promise<void>
}

export const keychainOwnerCache: OwnerCache = {
  async read() {
    try {
      return await SecureStore.getItemAsync(OWNER_CACHE_KEY)
    } catch (error) {
      devWarn('account', `The Keychain gave no cached owner: ${errorMessage(error)}`)
      return null
    }
  },
  async write(owner) {
    try {
      if (owner === null) await SecureStore.deleteItemAsync(OWNER_CACHE_KEY)
      else await SecureStore.setItemAsync(OWNER_CACHE_KEY, owner)
    } catch (error) {
      devWarn('account', `The Keychain did not keep the owner: ${errorMessage(error)}`)
    }
  },
  async pendingSignOut() {
    try {
      return (await SecureStore.getItemAsync(PENDING_SIGN_OUT_KEY)) !== null
    } catch (error) {
      devWarn('account', `The Keychain gave no pending sign-out: ${errorMessage(error)}`)
      return false
    }
  },
  async setPendingSignOut(pending) {
    try {
      if (pending) await SecureStore.setItemAsync(PENDING_SIGN_OUT_KEY, '1')
      else await SecureStore.deleteItemAsync(PENDING_SIGN_OUT_KEY)
    } catch (error) {
      devWarn('account', `The Keychain did not keep the pending sign-out: ${errorMessage(error)}`)
    }
  },
}
