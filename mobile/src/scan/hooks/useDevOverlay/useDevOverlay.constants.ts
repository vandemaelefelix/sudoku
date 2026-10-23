import type { CellStyle } from '@/scan/utils/correction.utils'

/** The kind tag of the dev confidence overlay: Printed, Handwritten, Notes, or none for an empty cell. */
export const KIND_TAG: Readonly<Record<CellStyle, string>> = { given: 'P', entry: 'H', notes: 'N', empty: '' }
