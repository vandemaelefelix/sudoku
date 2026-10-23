import { useSyncExternalStore } from 'react'

import { go } from '../../hooks/useRoute'

export interface FixQueue {
  /** Replace the queue with the marked photos, in gallery order. */
  replace: (photos: string[]) => void
  /** Take the next photo, or undefined when none is left. */
  take: () => string | undefined
  /** Empty the queue and drop the carried note. */
  clear: () => void
  size: () => number
  /** Keep a note for the gallery. The next `takeNote` returns it once. */
  carry: (note: string | undefined) => void
  takeNote: () => string | undefined
  subscribe: (listener: () => void) => () => void
}

/** The marked outlines that wait for the large view, and the note that the gallery shows next. */
export function createFixQueue(): FixQueue {
  let photos: string[] = []
  let note: string | undefined
  const listeners = new Set<() => void>()
  const change = (next: string[]): void => {
    photos = next
    for (const listener of listeners) listener()
  }
  return {
    replace: (next) => change([...next]),
    take: () => {
      const [first, ...rest] = photos
      if (first !== undefined) change(rest)
      return first
    },
    clear: () => {
      note = undefined
      change([])
    },
    size: () => photos.length,
    carry: (text) => {
      note = text
    },
    takeNote: () => {
      const taken = note
      note = undefined
      return taken
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** The Outlines step fills this queue. The large view takes the next photo from it. */
export const fixQueue = createFixQueue()

/** How many marked outlines wait. The component renders again when the number changes. */
export function useWaiting(): number {
  return useSyncExternalStore(fixQueue.subscribe, fixQueue.size)
}

/** Open the next marked outline, or the gallery with `note` when none is left. */
export function nextToFix(note?: string): void {
  const next = fixQueue.take()
  if (next === undefined) fixQueue.carry(note)
  go(next === undefined ? 'outlines' : `outlines/${next}`)
}
