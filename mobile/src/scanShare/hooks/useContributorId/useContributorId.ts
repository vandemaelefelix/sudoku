import { useEffect, useState } from 'react'
import { contributorId } from '@/scanShare/scanShareRuntime'

/** The contributor ID of this device, or null until it is read. */
export function useContributorId(): string | null {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    contributorId()
      .then((value) => live && setId(value))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return id
}
