import Constants from 'expo-constants'
import { syncApiUrlOf } from '@/sync/utils/syncConfig.utils'

export type ScanApiConfig = { baseUrl: string; appKey: string }

/**
 * The scans route sits on the same API as the sync route, so a build uploads to the stage that it syncs with. The development
 * variant has the development stage URL only (ADR-022). Null means this build uploads nothing: no URL or no app key.
 */
export function scanApiOf(extra: Record<string, unknown> | undefined): ScanApiConfig | null {
  const baseUrl = syncApiUrlOf(extra)
  const appKey = extra?.scanAppKey
  if (baseUrl === null || typeof appKey !== 'string' || appKey === '') return null
  return { baseUrl, appKey }
}

export function readScanApi(): ScanApiConfig | null {
  return scanApiOf(Constants.expoConfig?.extra)
}

/** "1.4.0 (212)", or "1.4.0" when the build has no number. */
export function versionLabel(): string {
  const version = Constants.expoConfig?.version ?? 'unknown'
  const build = Constants.expoConfig?.ios?.buildNumber
  return build === undefined ? version : `${version} (${build})`
}

/** The first eight characters of the contributor ID, as in the Settings footer. The player sends the full ID to delete scans. */
export function shortId(id: string): string {
  return id.slice(0, 8)
}
