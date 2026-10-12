const parse = (text: string): number[] => [...text].map(Number)

/** The puzzle of the design canvas. Tests use it. The package does not export it. */
export const SAMPLE_GIVENS = parse(
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
)

export const SAMPLE_SOLUTION = parse(
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
)

/** Entries that fill every open cell with its solution, except `cells`. */
export function solvedExcept(...cells: number[]): number[] {
  return SAMPLE_SOLUTION.map((digit, cell) =>
    SAMPLE_GIVENS[cell] !== 0 || cells.includes(cell) ? 0 : digit,
  )
}
