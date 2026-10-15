// No imports: infra/kill-switch-check.ts and sst.config.ts read the flag name too (ADR-027).
export const FLAG_PREFIX = '/sudoku/kill-switch'

// The kill switch writes one parameter per stage. A missing parameter means that the stage runs.
export const killSwitchFlagName = (stage: string): string => `${FLAG_PREFIX}/${stage}`

export interface FlagValue {
  at: string
  reason: string
}
