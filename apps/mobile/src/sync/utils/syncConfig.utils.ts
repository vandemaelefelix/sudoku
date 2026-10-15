import Constants from 'expo-constants'

/** The sync API base URL in the `extra` of the app config. Only an https URL counts. Null means this build has no sync. */
export function syncApiUrlOf(extra: Record<string, unknown> | undefined): string | null {
  const url = extra?.syncApiUrl
  if (typeof url !== 'string' || !url.startsWith('https://')) return null
  return url.replace(/\/+$/, '')
}

export function readSyncApiUrl(): string | null {
  return syncApiUrlOf(Constants.expoConfig?.extra)
}
