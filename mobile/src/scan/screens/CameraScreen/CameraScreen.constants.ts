export const FLASH_PEAK = 0.25

/** The status bar turns dark when the light background is half in. */
export const DARK_BAR_DIM = 0.5

/** The alert when the photo picker gives no image, for example an iCloud photo without the network. */
export const PICK_FAILED = {
  title: 'The image did not load',
  message: 'Choose another image. A photo that is only in iCloud needs the network.',
} as const
