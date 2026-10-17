import { createMemorySettings } from '@/settings/memorySettings'
import { CONTRIBUTOR_ID_KEY, NOTICE_SEEN_KEY, SHARE_SCANS_KEY } from './constants/scanShare.constants'
import {
  createContributorId,
  createNoticeStore,
  createShareStore,
  markNoticeSeen,
  readNoticeSeen,
} from './scanShareSettings'

describe('share store', () => {
  it('is on by default', () => {
    expect(createShareStore(createMemorySettings()).get()).toBe(true)
  })

  it('saves a change, tells the listeners and reads it back', async () => {
    const settings = createMemorySettings()
    const store = createShareStore(settings)
    const listener = jest.fn()
    store.subscribe(listener)
    await store.set(false)
    expect(store.get()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(await settings.get(SHARE_SCANS_KEY)).toBe('off')
    expect(createShareStore(settings).get()).toBe(false)
  })

  it('gives on when the store throws', () => {
    const settings = {
      ...createMemorySettings(),
      getSync: () => {
        throw new Error('locked')
      },
    }
    expect(createShareStore(settings).get()).toBe(true)
  })
})

describe('notice flag', () => {
  it('is false by default and true after the player saw the notice', async () => {
    const settings = createMemorySettings()
    expect(await readNoticeSeen(settings)).toBe(false)
    await markNoticeSeen(settings)
    expect(await readNoticeSeen(settings)).toBe(true)
    expect(await settings.get(NOTICE_SEEN_KEY)).toBe('yes')
  })
})

describe('contributor ID', () => {
  it('makes the ID once and keeps it', async () => {
    const settings = createMemorySettings()
    const newId = jest.fn(() => 'id-1')
    const id = createContributorId(settings, newId)
    expect(await Promise.all([id(), id()])).toEqual(['id-1', 'id-1'])
    expect(newId).toHaveBeenCalledTimes(1)
    expect(await createContributorId(settings, () => 'id-2')()).toBe('id-1')
    expect(await settings.get(CONTRIBUTOR_ID_KEY)).toBe('id-1')
  })
})

describe('notice store', () => {
  it('is not seen by default and not due', () => {
    const store = createNoticeStore(createMemorySettings())
    expect(store.seen()).toBe(false)
    expect(store.due()).toBe(false)
  })

  it('becomes due when a scan is queued, then saves the answer and tells the listeners', async () => {
    const settings = createMemorySettings()
    const store = createNoticeStore(settings)
    const listener = jest.fn()
    store.subscribe(listener)
    store.request()
    store.request()
    expect(store.due()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    await store.markSeen()
    expect(store.seen()).toBe(true)
    expect(store.due()).toBe(false)
    expect(await settings.get(NOTICE_SEEN_KEY)).toBe('yes')
    expect(createNoticeStore(settings).seen()).toBe(true)
  })

  it('does not become due once the notice was seen', () => {
    const store = createNoticeStore(createMemorySettings({ [NOTICE_SEEN_KEY]: 'yes' }))
    store.request()
    expect(store.due()).toBe(false)
  })
})
