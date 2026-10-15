import { createContext, useContext } from 'react'

/** unconfigured: the app variant has no Clerk key, so the account does not exist in this build. */
export type AccountStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn'

export type Account = {
  status: AccountStatus
  /** The primary email of the signed-in player. Null in every other status. */
  email: string | null
  /** Never rejects. It resolves false when Clerk could not sign the player out, and the player stays signed in. */
  signOut(): Promise<boolean>
  /**
   * A `sudoku-api` token for one request. `fresh` skips the Clerk token cache, for a retry after a 401.
   * Null when signed out, or when Clerk cannot give one. Never throws.
   */
  getApiToken(options?: { fresh?: boolean }): Promise<string | null>
  /**
   * The server deleted the account (ADR-028). For this session the owner is null and the status is signedOut, whatever
   * Clerk says. `signedOut` false: the next start tries the Clerk sign-out again, without a message.
   */
  markDeleted(result: { signedOut: boolean }): void
}

export const UNCONFIGURED_ACCOUNT: Account = {
  status: 'unconfigured',
  email: null,
  signOut: async () => true,
  getApiToken: async () => null,
  markDeleted: () => undefined,
}

export const AccountContext = createContext<Account>(UNCONFIGURED_ACCOUNT)

export function useAccount(): Account {
  return useContext(AccountContext)
}
