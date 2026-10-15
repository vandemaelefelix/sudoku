import { createContext, useContext } from 'react'

/**
 * The owner of the games finished now (ADR-028): the Clerk user ID of the signed-in player, or null when signed out.
 * The default is null, so an app without a provider writes games without an owner.
 */
export const OwnerContext = createContext<string | null>(null)

export function useOwner(): string | null {
  return useContext(OwnerContext)
}
