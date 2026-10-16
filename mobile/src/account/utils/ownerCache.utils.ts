import * as SecureStore from 'expo-secure-store'
import { OWNER_CACHE_KEY, PENDING_SIGN_OUT_KEY } from '@/account/constants/account.constants'
import { devWarn, errorMessage } from '@/utils/log.utils'

/** The cached Clerk user ID. A failed read gives null, so the Keychain never stops the play (SUD-01). */
export async function readCachedOwner(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(OWNER_CACHE_KEY)
  } catch (error) {
    devWarn('account', `The Keychain gave no cached owner: ${errorMessage(error)}`)
    return null
  }
}

/** Stores the owner, or clears the cache for null. A failed write is not fatal: the next start asks Clerk again. */
export async function writeCachedOwner(owner: string | null): Promise<void> {
  try {
    if (owner === null) await SecureStore.deleteItemAsync(OWNER_CACHE_KEY)
    else await SecureStore.setItemAsync(OWNER_CACHE_KEY, owner)
  } catch (error) {
    devWarn('account', `The Keychain did not keep the owner: ${errorMessage(error)}`)
  }
}

/** True when a deleted account is still signed in at Clerk. A failed read gives false. */
export async function readPendingSignOut(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PENDING_SIGN_OUT_KEY)) !== null
  } catch (error) {
    devWarn('account', `The Keychain gave no pending sign-out: ${errorMessage(error)}`)
    return false
  }
}

export async function writePendingSignOut(pending: boolean): Promise<void> {
  try {
    if (pending) await SecureStore.setItemAsync(PENDING_SIGN_OUT_KEY, '1')
    else await SecureStore.deleteItemAsync(PENDING_SIGN_OUT_KEY)
  } catch (error) {
    devWarn('account', `The Keychain did not keep the pending sign-out: ${errorMessage(error)}`)
  }
}
