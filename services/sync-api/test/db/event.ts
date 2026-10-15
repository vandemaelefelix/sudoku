import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'

// A payload v2 event as the HTTP API sends it after the JWT authorizer passed the token.
export function syncEvent(
  body: unknown,
  options: { sub?: string | null; raw?: boolean; base64?: boolean; routeKey?: string } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const { sub = 'user_test', raw = false, base64 = false, routeKey = 'POST /v1/sync' } = options
  const text = raw ? String(body) : JSON.stringify(body)
  const claims: Record<string, string> = { iss: 'https://clerk.test', aud: 'sudoku-api', email: 'player@example.com' }
  if (sub !== null) claims.sub = sub
  return {
    version: '2.0',
    routeKey,
    rawPath: '/v1/sync',
    rawQueryString: '',
    headers: {
      authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.secret-token.signature',
      'content-type': 'application/json',
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'api',
      authorizer: { principalId: '', integrationLatency: 0, jwt: { claims, scopes: [] } },
      domainName: 'api.test',
      domainPrefix: 'api',
      http: { method: 'POST', path: '/v1/sync', protocol: 'HTTP/1.1', sourceIp: '192.0.2.1', userAgent: 'test' },
      requestId: 'req-1',
      routeKey,
      stage: '$default',
      time: '15/Oct/2026:09:00:00 +0000',
      timeEpoch: 0,
    },
    body: base64 ? Buffer.from(text).toString('base64') : text,
    isBase64Encoded: base64,
  }
}
