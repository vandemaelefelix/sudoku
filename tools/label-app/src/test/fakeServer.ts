import { vi } from 'vitest'

type Answer = unknown | ((body: unknown) => unknown)

export class Refusal {
  constructor(
    readonly status: number,
    readonly body: object,
  ) {}
}

export interface FakeServer {
  /** The bodies of the POST calls, per path. */
  posts: Record<string, unknown[]>
}

/** Stub `fetch` with answers per path (with the query). A POST answer is wrapped in `{result}`. */
export function fakeServer(routes: Record<string, Answer>): FakeServer {
  const server: FakeServer = { posts: {} }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const post = init?.method === 'POST'
      const body: unknown = post ? JSON.parse(String(init?.body ?? '{}')) : undefined
      if (post) (server.posts[path] ??= []).push(body)
      if (!(path in routes)) return new Response(JSON.stringify({ error: `no fake for ${path}` }), { status: 404 })
      const route = routes[path]
      const answer = typeof route === 'function' ? (route as (b: unknown) => unknown)(body) : route
      if (answer instanceof Refusal) return new Response(JSON.stringify(answer.body), { status: answer.status })
      return new Response(JSON.stringify(post ? { result: answer } : answer), { status: 200 })
    }),
  )
  return server
}

export const START = {
  outlines: 2,
  scans: 1,
  scan_cells: 81,
  not_prelabelled: 0,
  digits: 12,
  kind: 0,
  doubtful: null,
  suspects: false,
  changes: 5,
}
