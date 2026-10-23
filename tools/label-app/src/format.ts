export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

export const percent = (p: number): string => `${Math.round(p * 100)} %`

export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))
