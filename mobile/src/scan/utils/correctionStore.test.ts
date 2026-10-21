import { Directory, File } from 'expo-file-system'
import type { Quad } from '@/utils/geometry.utils'
import type { CaptureOk } from './captureResult.utils'
import { cellLook } from './correction.utils'
import { finalGrid } from './finalGrid.utils'
import { saveScanCorrection } from './correctionStore'

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents/' },
  Directory: jest.fn(() => ({ create: jest.fn() })),
  File: jest.fn(() => ({ copy: jest.fn(), create: jest.fn(), write: jest.fn() })),
}))

// A valid solved grid: no digit repeats in a row, a column or a box.
const cells = Array.from({ length: 81 }, (_, i) => ({
  digit: ((Math.floor(i / 9) * 3 + Math.floor(i / 27) + (i % 9)) % 9) + 1,
  kind: 'printed' as const,
  confidence: 0.99,
  validPair: true,
  second: 1,
}))
const quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
] as Quad
const result: CaptureOk = {
  ok: true,
  cells,
  quad,
  corners: 'redetected',
  cornerOffset: null,
  timings: { imageMs: 0, detectMs: 0, flattenMs: 0, classifyMs: 0 },
  photoPath: '/tmp/photo.jpg',
  flatPath: '/tmp/flat.png',
}
const looks = cells.map((cell) => cellLook(cell))
const unchanged = finalGrid(cells, looks)
const { photoPath: _photoPath, ...withoutPhoto } = result

beforeEach(() => jest.clearAllMocks())

describe('saveScanCorrection', () => {
  it('saves nothing without the photo file', async () => {
    expect(await saveScanCorrection(withoutPhoto, unchanged)).toBe(false)
    expect(Directory).not.toHaveBeenCalled()
  })

  it('writes the photo, the flattened grid and scan.json, also for a scan without a correction', async () => {
    expect(await saveScanCorrection(result, unchanged)).toBe(true)
    expect(Directory).toHaveBeenCalledTimes(1)
    const files = jest.mocked(File).mock.results.map((r) => r.value)
    expect(jest.mocked(File).mock.calls[0]![0]).toBe('file:///tmp/photo.jpg')
    expect(jest.mocked(File).mock.calls[2]![0]).toBe('file:///tmp/flat.png')
    expect(files[2].copy).toHaveBeenCalledWith(files[3])
    const record = JSON.parse(files[4].write.mock.calls[0][0])
    expect(record.cells).toHaveLength(81)
    expect(record.cells.some((cell: { digitCorrected: boolean }) => cell.digitCorrected)).toBe(false)
  })

  it('records a correction', async () => {
    await saveScanCorrection(result, finalGrid(cells, [{ ...looks[0]!, style: 'entry' as const }, ...looks.slice(1)]))
    const json = jest.mocked(File).mock.results[4]!.value.write as jest.Mock
    expect(JSON.parse(json.mock.calls[0]![0]).cells[0]).toMatchObject({
      kindCorrected: true,
      final: { kind: 'handwritten' },
    })
  })

  it('returns false and does not throw when the files fail', async () => {
    jest.mocked(Directory).mockImplementationOnce(() => {
      throw new Error('disk full')
    })
    expect(await saveScanCorrection(result, unchanged)).toBe(false)
  })
})
