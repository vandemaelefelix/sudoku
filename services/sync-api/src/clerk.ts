export class ClerkError extends Error {
  override name = 'ClerkError'
}

export interface ClerkClient {
  deleteUser(userId: string): Promise<void>
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

// 200 is a deleted user. 404 is a user that is already gone, so a retry after a half-done delete succeeds (ADR-027).
// The message holds only the status: a Clerk body or a network message can hold the user ID.
export function createClerkClient(secretKey: string, fetchImpl: FetchLike = fetch, timeoutMs = 8000): ClerkClient {
  return {
    async deleteUser(userId) {
      let response: Response
      try {
        response = await fetchImpl(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${secretKey}` },
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch {
        throw new ClerkError('Clerk did not answer.')
      }
      if (response.status === 200 || response.status === 404) return
      throw new ClerkError(`Clerk answered ${response.status}.`)
    },
  }
}
