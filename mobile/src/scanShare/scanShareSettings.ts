import type { SettingsRepository } from '@/preferences/SettingsRepository'
import { createSettingStore, type SettingDefinition } from '@/preferences/settingStore'
import { CONTRIBUTOR_ID_KEY, NOTICE_SEEN_KEY, SHARE_SCANS_KEY } from './constants/scanShare.constants'

/** Sharing is on unless the player turned it off (ADR-030). A store that throws gives on, as the default says. */
export const SHARE_SCANS_SETTING: SettingDefinition<boolean> = {
  key: SHARE_SCANS_KEY,
  area: 'scanShare',
  label: 'sharing switch',
  parse: (value) => value !== 'off',
  serialize: (on) => (on ? 'on' : 'off'),
}

export type NoticeStore = {
  /** True once the player answered the first-upload notice. */
  seen(): boolean
  /** True when a scan waits for the notice. The sheet shows only then, so it never opens on a screen without a scan. */
  due(): boolean
  /** The pair of values for `useSyncExternalStore`. It changes when `seen` or `due` changes. */
  snapshot(): string
  subscribe(listener: () => void): () => void
  /** Marks that a scan was queued. Does nothing once the notice was seen. */
  request(): void
  /** Saves the flag. Memory and listeners change first, as in every setting store. */
  markSeen(): Promise<void>
}

/** The first-upload notice state. The uploader reads `seen` before every scan (ADR-030). A store that throws gives "not seen". */
export function createNoticeStore(settings: SettingsRepository): NoticeStore {
  const seen = createSettingStore<boolean>(settings, {
    key: NOTICE_SEEN_KEY,
    area: 'scanShare',
    label: 'notice flag',
    parse: (value) => value === 'yes',
    serialize: (isSeen) => (isSeen ? 'yes' : 'no'),
  })
  let due = false
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  return {
    seen: seen.get,
    due: () => due,
    snapshot: () => `${seen.get()}:${due}`,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    request() {
      if (seen.get() || due) return
      due = true
      notify()
    },
    async markSeen() {
      due = false
      // retrySave: a first save may have failed, and the notice must not show again after the next launch.
      const saving = seen.set(true, { retrySave: true })
      notify()
      await saving
    },
  }
}

/**
 * The random ID of this device, made once and kept (ADR-030). It names the scans of a player who is not signed in.
 * Two calls at once get the same ID.
 */
export function createContributorId(settings: SettingsRepository, newId: () => string): () => Promise<string> {
  let pending: Promise<string> | null = null
  const load = async (): Promise<string> => {
    const saved = await settings.get(CONTRIBUTOR_ID_KEY)
    if (saved !== null) return saved
    const id = newId()
    await settings.set(CONTRIBUTOR_ID_KEY, id)
    return id
  }
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = null
      throw error
    })
    return pending
  }
}
