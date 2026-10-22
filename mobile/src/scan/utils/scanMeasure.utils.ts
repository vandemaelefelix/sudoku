/** The recognition timings of a scan, in ms. */
export type RecognitionTimings = { imageMs: number; detectMs: number; flattenMs: number; classifyMs: number }

/** QR-07 sets a target for the recognition alone: the sum of these parts. */
export function formatRecognition(t: RecognitionTimings): string {
  const total = t.imageMs + t.detectMs + t.flattenMs + t.classifyMs
  return `recognition ${total} ms: image ${t.imageMs} ms, detect ${t.detectMs} ms, flatten ${t.flattenMs} ms, classify ${t.classifyMs} ms`
}

export type HeapStats = { heapBytes: number; allocatedBytes: number; collections: number }

type Engine = { getInstrumentedStats?: () => Record<string, number | undefined> } | undefined

/** The JS heap from the Hermes engine (`globalThis.HermesInternal`), or null when the engine gives none. */
export function heapStats(engine: Engine): HeapStats | null {
  const stats = engine?.getInstrumentedStats?.()
  const heapBytes = stats?.js_heapSize
  if (heapBytes === undefined) return null
  return { heapBytes, allocatedBytes: stats?.js_allocatedBytes ?? 0, collections: stats?.js_numGCs ?? 0 }
}

const MB = 1024 * 1024

/** QR-08: a heap that grows from line to line over 5 minutes is a leak in the JS side. */
export function formatHeap(scanningMs: number, heap: HeapStats | null): string {
  const minutes = `scanning ${(scanningMs / 60_000).toFixed(1)} min`
  if (heap === null) return `${minutes}: no JS heap from this engine`
  return (
    `${minutes}: JS heap ${(heap.heapBytes / MB).toFixed(1)} MB, ` +
    `allocated ${(heap.allocatedBytes / MB).toFixed(1)} MB, ${heap.collections} collections`
  )
}
