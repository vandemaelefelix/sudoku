// No imports: Node runs smoke.ts directly, and the unit tests import this file.

export interface CheckResult {
  name: string
  ok: boolean
  // A status code or a short fact. Never a token or a response body.
  detail: string
}

export function apiUrlFrom(outputs: unknown): string {
  const url = (outputs as { apiUrl?: unknown } | null)?.apiUrl
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('.sst/outputs.json has no apiUrl. Run just deploy-api felix first.')
  }
  return url
}

// The smoke test creates a Clerk session and writes a game row, so it runs only against the development instance.
export function assertSmokeAllowed(stage: string, secretKey: string | undefined): void {
  if (stage === 'production') throw new Error('The smoke test does not run on production.')
  if (!secretKey) throw new Error('Export CLERK_SECRET_KEY in your shell first. Do not paste it in a chat.')
  if (!secretKey.startsWith('sk_test_')) {
    throw new Error('CLERK_SECRET_KEY must belong to the Clerk development instance (sk_test_).')
  }
}

export function report(results: readonly CheckResult[]): { text: string; passed: boolean } {
  const rows = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail})`)
  const passed = results.every((r) => r.ok)
  return { text: [...rows, passed ? 'Smoke test passed.' : 'Smoke test failed.'].join('\n'), passed }
}
