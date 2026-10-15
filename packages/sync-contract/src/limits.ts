export const HISTORY_ENTRY_VERSION = 1
export const MAX_ENTRIES_PER_SYNC = 100
export const MAX_CHANGES_PER_SYNC = 500
/** Characters. The app stores the cursor and never reads it (ADR-028). */
export const MAX_CURSOR_LENGTH = 1024
/** The generator truncates a seed to an unsigned 32-bit integer (ADR-011). */
export const MAX_SEED = 0xffffffff
/** Characters. */
export const MAX_ERROR_MESSAGE_LENGTH = 500
