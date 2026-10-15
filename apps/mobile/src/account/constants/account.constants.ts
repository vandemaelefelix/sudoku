/** The Clerk JWT template that the sync API accepts (ADR-027). Clerk gives a token for 60 s and renews it. */
export const API_TOKEN_TEMPLATE = 'sudoku-api'

/** The length of the email code that Clerk sends. */
export const CODE_LENGTH = 6

/** The sign-in screens show this when the app variant has no Clerk key. */
export const UNCONFIGURED_MESSAGE = 'Accounts are not available in this version of the app.'

/** The Keychain item that holds the last signed-in Clerk user ID, the owner until Clerk has loaded (ADR-028). */
export const OWNER_CACHE_KEY = 'sudoku.owner'

/** The delete call keeps one token. After the Clerk user is gone, Clerk cannot give a new one (ADR-027). */
export const DELETE_RETRIES = 2
export const DELETE_RETRY_DELAY_MS = 1_000

export const DELETE_CONFIRM_TITLE = 'Delete account?'
export const DELETE_CONFIRM_MESSAGE =
  'This deletes your account and the games backed up to it. The games on this iPhone that belong to the account are deleted too. You cannot undo this.'
export const DELETE_CONFIRM_ACTION = 'Delete account'
export const DELETE_PENDING_HINT = 'Deleting the account…'
export const DELETE_FAILED_TITLE = 'Could not delete the account'
export const DELETE_OFFLINE_MESSAGE = 'Deleting needs the internet. Check your connection and try again.'
export const DELETE_FAILED_MESSAGE = 'Something went wrong. Your account is not deleted. Try again.'
export const DELETED_TITLE = 'Account deleted'
export const DELETED_MESSAGE = 'Your account and its backed-up games are deleted.'
