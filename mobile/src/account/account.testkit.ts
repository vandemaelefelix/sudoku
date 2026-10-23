import type { OwnerCache } from '@/account/utils/ownerCache.utils'

/** The owner cache in memory. `current` and `isPending` show what the Keychain would hold. */
export function memoryOwnerCache(owner: string | null = null) {
  let cached = owner
  let pending = false
  const cache: OwnerCache = {
    read: async () => cached,
    write: async (next) => {
      cached = next
    },
    pendingSignOut: async () => pending,
    setPendingSignOut: async (next) => {
      pending = next
    },
  }
  return Object.assign(cache, { current: () => cached, isPending: () => pending })
}
