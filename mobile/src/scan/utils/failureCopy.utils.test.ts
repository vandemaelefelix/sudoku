import { NO_GRID } from '@/scanner'
import { failureCopy } from './failureCopy.utils'

describe('failureCopy', () => {
  it('says that no grid was found, for a photo of the camera', () => {
    expect(failureCopy(NO_GRID, false)).toEqual({ title: 'scan.failure.title', reason: 'scan.failure.noGrid' })
  })

  it('tells the player what to pick, for an import without a grid', () => {
    expect(failureCopy(NO_GRID, true)).toEqual({
      title: 'scan.failure.importTitle',
      reason: 'scan.failure.importReason',
    })
  })

  it('reads any other reason as a plain failure, also for an import', () => {
    const plain = { title: 'scan.failure.title', reason: 'scan.failure.other' }
    expect(failureCopy('the file is not an image', false)).toEqual(plain)
    expect(failureCopy('the file is not an image', true)).toEqual(plain)
    expect(failureCopy(null, false)).toEqual(plain)
  })
})
