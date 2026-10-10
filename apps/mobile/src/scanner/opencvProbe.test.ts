import { Mat } from 'react-native-fast-opencv'
import { probeOpenCV } from './opencvProbe'

describe('probeOpenCV', () => {
  it('creates, checks and releases one Mat', () => {
    expect(probeOpenCV()).toBe(true)
    const mat = jest.mocked(Mat.create).mock.results[0]?.value as { release: jest.Mock }
    expect(mat.release).toHaveBeenCalledTimes(1)
  })

  it('reports false when the Mat has the wrong size', () => {
    jest.mocked(Mat.create).mockReturnValueOnce({ rows: 0, cols: 0, release: jest.fn() } as never)
    expect(probeOpenCV()).toBe(false)
  })
})
