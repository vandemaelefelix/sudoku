export const GRID_CELLS = 81

/** 0 marks an empty cell. */
export function createEmptyGrid(): number[] {
  return Array.from({ length: GRID_CELLS }, () => 0)
}
