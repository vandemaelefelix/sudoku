/** The time zone of the device as an IANA name. UTC when the runtime does not tell. */
export function deviceTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
}
