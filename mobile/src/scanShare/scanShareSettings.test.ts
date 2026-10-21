import { createMemorySettings } from '@/settings/memorySettings'
import { CONTRIBUTOR_ID_KEY, NOTICE_SEEN_KEY, SHARE_SCANS_KEY } from './constants/scanShare.constants'
import { createSettingStore } from '@/settings/settingStore'
import { createContributorId, createNoticeStore, SHARE_SCANS_SETTING } from './scanShareSettings'

describe('share setting', () => {
  it('is on by default and off only for "off"', () => {
    expect(SHARE_SCANS_SETTING.parse(null)).toBe(true)
    expect(SHARE_SCANS_SETTING.parse('on')).toBe(true)
    expect(SHARE_SCANS_SETTING.parse('broken')).toBe(true)
    expect(SHARE_SCANS_SETTING.parse('off')).toBe(false)
  })

  it('saves "on" or "off" under the same key', async () => {
    const settings = createMemorySettings()
    await createSettingStore(settings, SHARE_SCANS_SETTING).set(false)
    expect(await settings.get(SHARE_SCANS_KEY)).toBe('off')
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

  it('saves the answer again when the first save failed', async () => {
    const settings = createMemorySettings()
    const save = jest.spyOn(settings, 'set').mockRejectedValueOnce(new Error('disk full'))
    const store = createNoticeStore(settings)
    await expect(store.markSeen()).rejects.toThrow('disk full')
    expect(store.seen()).toBe(true)
    await store.markSeen()
    expect(save).toHaveBeenCalledTimes(2)
    expect(await settings.get(NOTICE_SEEN_KEY)).toBe('yes')
  })

  it('does not become due once the notice was seen', () => {
    const store = createNoticeStore(createMemorySettings({ [NOTICE_SEEN_KEY]: 'yes' }))
    store.request()
    expect(store.due()).toBe(false)
  })
})
