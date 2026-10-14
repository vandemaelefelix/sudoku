import { SWAP_DELAY_MS, SWAP_MS, SWAP_RISE, SWAP_STAGGER_MS } from '@/scan/constants/swap.constants'
import { riseIn } from '@/utils/motion.utils'

/** The new content of the panel. */
export const swapIn = riseIn(SWAP_DELAY_MS, SWAP_RISE, SWAP_MS)

/** The buttons of the new content. They follow the rest of it by SWAP_STAGGER_MS and only fade. */
export const swapInButtons = riseIn(SWAP_DELAY_MS + SWAP_STAGGER_MS, 0, SWAP_MS)
