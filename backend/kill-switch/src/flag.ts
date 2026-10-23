// No imports: backend/infra and sst.config.ts read these names too (ADR-027).

// The `name` of the SST app. SST names a function `<app>-<stage>-<logical name><hash>`.
export const APP_NAME = 'sudoku'

// The logical names of the Lambdas that the kill switch stops (SUD-11, ADR-030: two functions).
// backend/infra/api.ts and scans.ts create the functions with these names, so a rename cannot drop one from the stop list.
export const API_FUNCTION_NAMES = {
  sync: 'SyncApiFunction',
  scans: 'ScansFunction',
} as const

export const FLAG_PREFIX = `/${APP_NAME}/kill-switch`

// The kill switch writes one parameter per stage. A missing parameter means that the stage runs.
export const killSwitchFlagName = (stage: string): string => `${FLAG_PREFIX}/${stage}`

export interface FlagValue {
  at: string
  reason: string
}
