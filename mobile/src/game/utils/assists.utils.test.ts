import { ASSISTS_KEY, DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { createMemorySettings } from '@/settings/memorySettings'
import { createAssistsStore, parseAssists } from './assists.utils'

const saved = (value: object) => createMemorySettings({ [ASSISTS_KEY]: JSON.stringify(value) })

describe('parseAssists', () => {
  it('gives every assist on when nothing is saved', () => {
    expect(parseAssists(null)).toEqual(DEFAULT_ASSISTS)
  })

  it('keeps the saved switches', () => {
    const value = { rowColumn: false, box: true, selectedCell: false, sameNumbers: true }
    expect(parseAssists(JSON.stringify(value))).toEqual(value)
  })

  it('turns on an assist that the saved value does not hold', () => {
    expect(parseAssists(JSON.stringify({ box: false }))).toEqual({ ...DEFAULT_ASSISTS, box: false })
  })

  it.each(['', 'not json', '[]', 'null', '42', JSON.stringify({ box: 'no' })])(
    'falls back to the defaults for %p',
    (value) => {
      expect(parseAssists(value)).toEqual(DEFAULT_ASSISTS)
    },
  )
})

describe('createAssistsStore', () => {
  it('reads the saved assists on the first get, and only once', () => {
    const settings = saved({ ...DEFAULT_ASSISTS, box: false })
    const getSync = jest.spyOn(settings, 'getSync')
    const store = createAssistsStore(settings)
    expect(getSync).not.toHaveBeenCalled()
    expect(store.get().box).toBe(false)
    store.get()
    expect(getSync).toHaveBeenCalledTimes(1)
  })

  it('keeps the same object until a change, so React sees a stable snapshot', () => {
    const store = createAssistsStore(createMemorySettings())
    expect(store.get()).toBe(store.get())
  })

  it('changes one assist, tells every listener and saves the result', async () => {
    const settings = createMemorySettings()
    const store = createAssistsStore(settings)
    const first = jest.fn()
    const second = jest.fn()
    store.subscribe(first)
    store.subscribe(second)
    await store.set('sameNumbers', false)
    expect(store.get()).toEqual({ ...DEFAULT_ASSISTS, sameNumbers: false })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(await settings.get(ASSISTS_KEY)).toBe(JSON.stringify({ ...DEFAULT_ASSISTS, sameNumbers: false }))
  })

  it('does nothing when the assist already has the value', async () => {
    const settings = createMemorySettings()
    const save = jest.spyOn(settings, 'set')
    const store = createAssistsStore(settings)
    const before = store.get()
    const listener = jest.fn()
    store.subscribe(listener)
    await store.set('box', true)
    expect(store.get()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('stops telling a listener after it unsubscribes', async () => {
    const store = createAssistsStore(createMemorySettings())
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    await store.set('box', false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('gives the defaults when the store throws, so the game still starts', () => {
    const settings = createMemorySettings()
    settings.getSync = () => {
      throw new Error('disk')
    }
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(createAssistsStore(settings).get()).toEqual(DEFAULT_ASSISTS)
    expect(log).toHaveBeenCalledWith('[assists] saved assists unreadable: disk')
    log.mockRestore()
  })
})
