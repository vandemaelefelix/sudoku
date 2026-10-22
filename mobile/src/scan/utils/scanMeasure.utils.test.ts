import { formatHeap, formatRecognition, heapStats } from './scanMeasure.utils'

describe('formatRecognition', () => {
  it('lists each part of the recognition and their sum', () => {
    expect(formatRecognition({ imageMs: 12, detectMs: 30, flattenMs: 8, classifyMs: 41 })).toBe(
      'recognition 91 ms: image 12 ms, detect 30 ms, flatten 8 ms, classify 41 ms',
    )
  })
})

describe('heapStats', () => {
  it('reads the heap of the Hermes engine', () => {
    const engine = {
      getInstrumentedStats: () => ({ js_heapSize: 8_388_608, js_allocatedBytes: 4_194_304, js_numGCs: 7 }),
    }
    expect(heapStats(engine)).toEqual({ heapBytes: 8_388_608, allocatedBytes: 4_194_304, collections: 7 })
  })

  it('gives null without Hermes', () => {
    expect(heapStats(undefined)).toBeNull()
    expect(heapStats({})).toBeNull()
  })
})

describe('formatHeap', () => {
  it('gives the scan time and the heap in MB', () => {
    expect(formatHeap(90_000, { heapBytes: 8_388_608, allocatedBytes: 4_194_304, collections: 7 })).toBe(
      'scanning 1.5 min: JS heap 8.0 MB, allocated 4.0 MB, 7 collections',
    )
  })

  it('says so when the engine gives no heap', () => {
    expect(formatHeap(30_000, null)).toBe('scanning 0.5 min: no JS heap from this engine')
  })
})
