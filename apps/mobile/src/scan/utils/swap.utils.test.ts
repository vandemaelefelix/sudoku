import { SWAP_RISE } from '@/scan/constants/swap.constants'
import { swapIn, swapInButtons } from './swap.utils'

describe('swapIn', () => {
  it('starts hidden and lowered by SWAP_RISE', () => {
    expect(swapIn().initialValues).toEqual({ opacity: 0, transform: [{ translateY: SWAP_RISE }] })
  })
})

describe('swapInButtons', () => {
  it('starts hidden in place: the buttons only fade', () => {
    expect(swapInButtons().initialValues).toEqual({ opacity: 0, transform: [{ translateY: 0 }] })
  })
})
