export class ApiError extends Error {
  /** The AWS session expired: the Fetch step offers the sign-in. */
  readonly signIn: boolean

  constructor(message: string, signIn = false) {
    super(message)
    this.signIn = signIn
  }
}

const UNREACHABLE = 'Cannot reach the server. Start it again with just label-cells.'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw new ApiError(UNREACHABLE)
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (body ?? {}) as { error?: string; sign_in?: boolean }
    throw new ApiError(error.error ?? `The server answered ${response.status}.`, error.sign_in === true)
  }
  return body as T
}

export function get<T>(path: string): Promise<T> {
  return call<T>(path)
}

/** The server answers `{"result": ...}`. */
export async function post<T>(path: string, body: object = {}): Promise<T> {
  const answer = await call<{ result: T }>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return answer.result
}

export const cellImage = (stem: string): string => `/cell/${stem}.png`
export const outlineImage = (photo: string, version = 0): string => `/outline/${photo}.jpg?v=${version}`
export const photoImage = (photo: string): string => `/photo/${photo}.jpg`
export const flatImage = (photo: string, corners: number[][]): string =>
  `/flat/${photo}.png?c=${corners.flat().join(',')}`
