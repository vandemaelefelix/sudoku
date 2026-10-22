import { isDevelopmentVariant } from './appVariant.utils'

/** The quality scenarios of chapter 10 that the app measures on the device. */
export type QualityId = 'QR-05' | 'QR-06' | 'QR-07' | 'QR-08' | 'QR-12'

/** True in the development variant, also in its Release build. The production variant measures nothing (ADR-022). */
export function isMeasuring(): boolean {
  return isDevelopmentVariant()
}

/**
 * Logs `[measure] <id> <message>`. React Native writes it to the iOS system log as an info message, also in a
 * Release build, so Console.app on a Mac reads it. Nothing leaves the phone (SUD-02).
 */
export function measureLog(id: QualityId, message: string): void {
  if (isMeasuring()) console.log(`[measure] ${id} ${message}`)
}

/** The marks of QR-12, from the load of the bundle to a playable board. */
export type StartMeasures = {
  homeShown(): void
  /** A tap while an earlier start runs keeps the earlier mark, because that start shows the board. */
  levelTapped(level: string): void
  /** The tap started no game: the player kept the game in progress, or the start failed. */
  tapCancelled(): void
  /** The player answered the replace question with New game. The wait for the answer is not part of QR-12. */
  replaceConfirmed(): void
  generated(level: string, ms: number): void
  boardShown(): void
}

/**
 * The clock starts when this is called. The time before the bundle loads (the native launch) is not in it:
 * Instruments measures that part.
 */
export function createStartMeasures(now: () => number, log: (id: QualityId, message: string) => void): StartMeasures {
  const loadedAt = now()
  let homeLogged = false
  let boardsShown = 0
  let tap: { level: string; at: number } | null = null
  return {
    homeShown() {
      if (homeLogged) return
      homeLogged = true
      log('QR-12', `home shown ${now() - loadedAt} ms after the bundle loaded`)
    },
    levelTapped(level) {
      if (tap === null) tap = { level, at: now() }
    },
    tapCancelled() {
      tap = null
    },
    replaceConfirmed() {
      if (tap !== null) tap = { ...tap, at: now() }
    },
    generated(level, ms) {
      log('QR-12', `${level} generated in ${ms} ms`)
    },
    boardShown() {
      if (tap === null) return
      const shown = now()
      const first = boardsShown === 0 ? `, ${shown - loadedAt} ms after the bundle loaded (first board)` : ''
      log('QR-12', `${tap.level} board shown ${shown - tap.at} ms after the tap${first}`)
      boardsShown++
      tap = null
    },
  }
}

/** The one instance of the app. This module loads early in the bundle, so its clock starts near the bundle load. */
export const startMeasures = createStartMeasures(Date.now, measureLog)
