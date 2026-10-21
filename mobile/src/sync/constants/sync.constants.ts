/** One run ends after this many requests. The next trigger continues from the saved cursor. */
export const MAX_ROUNDS = 20

/** After a run that reached the most rounds, the service starts at most this many more runs at once. */
export const MAX_FOLLOW_UP_RUNS = 5

/** The API throttle is 1 request per second with a burst of 10 (ADR-027). From this round, a pause keeps a full pull under it. */
export const PAUSE_AFTER_ROUND = 8
export const ROUND_PAUSE_MS = 1_100

export const REQUEST_TIMEOUT_MS = 20_000

/** Longer than the 30 s of the Lambda, so a retry never runs beside the first call (ADR-028). */
export const DELETE_TIMEOUT_MS = 35_000

export const BACKOFF_BASE_MS = 30_000
export const BACKOFF_MAX_MS = 15 * 60_000

export const REFRESH_SYNCED_LINE_MS = 60_000

export const ADOPT_TITLE = 'Add the games on this phone to your account?'
export const ADOPT_MESSAGE =
  'These games were played before you signed in. They will back up to your account and show on your other devices.'
export const ADOPT_DECLINE = 'Not now'
export const ADOPT_ACCEPT = 'Add games'

export const ACCOUNT_DELETED_TITLE = 'This account was deleted. You are signed out.'
