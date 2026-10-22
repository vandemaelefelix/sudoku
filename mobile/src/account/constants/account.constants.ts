/** The Clerk JWT template that the sync API accepts (ADR-027). Clerk gives a token for 60 s and renews it. */
export const API_TOKEN_TEMPLATE = 'sudoku-api'

/** The length of the email code that Clerk sends. */
export const CODE_LENGTH = 6

/** The Keychain item that holds the last signed-in Clerk user ID, the owner until Clerk has loaded (ADR-028). */
export const OWNER_CACHE_KEY = 'sudoku.owner'

/** The Keychain flag of a deleted account whose Clerk sign-out failed. The next start signs out again (ADR-028). */
export const PENDING_SIGN_OUT_KEY = 'sudoku.pendingSignOut'

/** The delete call keeps one token. After the Clerk user is gone, Clerk cannot give a new one (ADR-027). */
export const DELETE_RETRIES = 2
export const DELETE_RETRY_DELAY_MS = 1_000
