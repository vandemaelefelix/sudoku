import { useAccount } from '@/account/hooks/useAccount'

/** Call the result before each request to the sync API. Clerk keeps the token while it is valid. */
export function useApiToken(): () => Promise<string | null> {
  return useAccount().getApiToken
}
