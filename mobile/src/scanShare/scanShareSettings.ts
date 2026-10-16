import type { SettingsRepository } from '@/settings/SettingsRepository'
import { devLog, errorMessage } from '@/utils/log.utils'
import { CONTRIBUTOR_ID_KEY, NOTICE_SEEN_KEY, SHARE_SCANS_KEY } from './constants/scanShare.constants'

export type ShareStore = {
  get(): boolean
  subscribe(listener: () => void): () => void
  /** Changes the value in memory and tells the listeners first. Then it saves. A failed save rejects. */
  set(on: boolean): Promise<void>
}

/** Sharing is on unless the player turned it off (ADR-030). A store that throws gives on, as the default says. */
export function readShareScans(settings: SettingsRepository): boolean {
  try {
    return settings.getSync(SHARE_SCANS_KEY) !== 'off'
  } catch (error) {
    devLog('scanShare', `saved sharing switch unreadable: ${errorMessage(error)}`)
    return true
  }
}

export function createShareStore(settings: SettingsRepository): ShareStore {
  let current: boolean | null = null
  const listeners = new Set<() => void>()
  const get = (): boolean => {
    current ??= readShareScans(settings)
    return current
  }
  return {
    get,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async set(on) {
      if (get() === on) return
      current = on
      for (const listener of listeners) listener()
      await settings.set(SHARE_SCANS_KEY, on ? 'on' : 'off')
    },
  }
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
  /** Saves the flag. Memory and listeners change first, as in the share store. */
  markSeen(): Promise<void>
}

/** The first-upload notice state. The uploader reads `seen` before every scan (ADR-030). A store that throws gives "not seen". */
export function createNoticeStore(settings: SettingsRepository): NoticeStore {
  let seen: boolean | null = null
  let due = false
  const listeners = new Set<() => void>()
  const isSeen = (): boolean => {
    if (seen === null) {
      try {
        seen = settings.getSync(NOTICE_SEEN_KEY) === 'yes'
      } catch (error) {
        devLog('scanShare', `saved notice flag unreadable: ${errorMessage(error)}`)
        seen = false
      }
    }
    return seen
  }
  const notify = () => {
    for (const listener of listeners) listener()
  }
  return {
    seen: isSeen,
    due: () => due,
    snapshot: () => `${isSeen()}:${due}`,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    request() {
      if (isSeen() || due) return
      due = true
      notify()
    },
    async markSeen() {
      seen = true
      due = false
      notify()
      await markNoticeSeen(settings)
    },
  }
}

/** False until the player has seen the first-upload notice. */
export async function readNoticeSeen(settings: SettingsRepository): Promise<boolean> {
  return (await settings.get(NOTICE_SEEN_KEY)) === 'yes'
}

export async function markNoticeSeen(settings: SettingsRepository): Promise<void> {
  await settings.set(NOTICE_SEEN_KEY, 'yes')
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
