export class ClerkError extends Error {
  override name = 'ClerkError'
}

export interface ClerkClient {
  deleteUser(userId: string): Promise<void>
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

// 200 is a deleted user. 404 with the code resource_not_found is a user that is already gone, so a retry succeeds
// (ADR-027). Any other 404, such as a wrong URL, fails. The message holds only the status: a Clerk body or a network
// message can hold the user ID.
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
      if (response.status === 200) return
      if (response.status === 404 && (await isResourceNotFound(response))) return
      throw new ClerkError(`Clerk answered ${response.status}.`)
    },
  }
}

async function isResourceNotFound(response: Response): Promise<boolean> {
  try {
    const body = (await response.json()) as { errors?: { code?: unknown }[] }
    return body.errors?.some((error) => error.code === 'resource_not_found') === true
  } catch {
    return false
  }
}

// A stage without Clerk links no secret (ADR-027 amendment, delete the account). The call then fails with a ClerkError.
export function lazyClerkClient(readSecret: () => string): ClerkClient {
  return {
    async deleteUser(userId) {
      let secret: string
      try {
        secret = readSecret()
      } catch {
        throw new ClerkError('No Clerk secret is linked.')
      }
      await createClerkClient(secret).deleteUser(userId)
    },
  }
}
