// The account lives in React. The useScanShare hook hands the current token source to this module.
let getToken: () => Promise<string | null> = async () => null

export function setTokenSource(next: () => Promise<string | null>): void {
  getToken = next
}

export function readToken(): Promise<string | null> {
  return getToken()
}
