import { createContext, useContext } from 'react'

/**
 * The account that owns the games finished now (ADR-028): its user id, or null when signed out.
 * The default is null, so an app without a provider writes games without an owner.
 */
export const OwnerContext = createContext<string | null>(null)

export function useOwner(): string | null {
  return useContext(OwnerContext)
}
