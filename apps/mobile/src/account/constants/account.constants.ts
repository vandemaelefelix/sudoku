/** The Clerk JWT template that the sync API accepts (ADR-027). Clerk gives a token for 60 s and renews it. */
export const API_TOKEN_TEMPLATE = 'sudoku-api'

/** The length of the email code that Clerk sends. */
export const CODE_LENGTH = 6

/** The sign-in screens show this when the app variant has no Clerk key. */
export const UNCONFIGURED_MESSAGE = 'Accounts are not available in this version of the app.'

/** The Keychain item that holds the last signed-in Clerk user ID, the owner until Clerk has loaded (ADR-028). */
export const OWNER_CACHE_KEY = 'sudoku.owner'
