import Constants from 'expo-constants'

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
