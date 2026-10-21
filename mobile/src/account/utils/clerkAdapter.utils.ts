import { API_TOKEN_TEMPLATE } from '@/account/constants/account.constants'
import { devWarn, errorMessage } from '@/utils/log.utils'

/** What the account lifecycle needs from Clerk. The real adapter wraps `@clerk/expo`. Tests give a fake. */
export type ClerkAdapter = {
  /**
   * A `sudoku-api` token for one request. `fresh` skips the Clerk token cache, for a retry after a 401.
   * Null when Clerk cannot give one, for example when signed out. Never throws.
   */
  getApiToken(options?: { fresh?: boolean }): Promise<string | null>
  /** Never rejects. It resolves false when Clerk could not sign the player out, and the player stays signed in. */
  signOut(): Promise<boolean>
}

/** The functions of `useAuth` that the adapter uses. */
type ClerkAuth = {
  getToken(options: { template: string; skipCache?: boolean }): Promise<string | null>
  signOut(): Promise<unknown>
}

export function createClerkAdapter({ getToken, signOut }: ClerkAuth): ClerkAdapter {
  return {
    async getApiToken(options) {
      try {
        return await getToken(
          options?.fresh === true
            ? { template: API_TOKEN_TEMPLATE, skipCache: true }
            : { template: API_TOKEN_TEMPLATE },
        )
      } catch (error) {
        devWarn('account', `Clerk gave no API token: ${errorMessage(error)}`)
        return null
      }
    },
    async signOut() {
      try {
        await signOut()
        return true
      } catch (error) {
        devWarn('account', `Clerk did not sign out: ${errorMessage(error)}`)
        return false
      }
    },
  }
}
