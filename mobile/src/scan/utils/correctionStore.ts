import { Directory, File, Paths } from 'expo-file-system'
import type { FinalGrid } from '@/utils/finalGrid.utils'
import { devWarn, errorMessage } from '@/utils/log.utils'
import type { CaptureResult } from './captureResult.utils'
import { buildScanRecord } from './correctionLog.utils'

const FOLDER = 'scan-corrections'

function fileUri(path: string): string {
  return path.startsWith('file:') ? path : `file://${path}`
}

/**
 * Saves a scan with the corrections of the player as Documents/scan-corrections/<time>/: photo.jpg (upright), flat.png (the grid the
 * cells were cut from) and scan.json. The files stay on the phone until the developer copies them (SUD-02). Returns false, and never
 * throws, when the scan cannot be saved: the screen shows that.
 */
export async function saveScanCorrection(result: CaptureResult | null, finalGrid: FinalGrid): Promise<boolean> {
  try {
    if (result == null || !result.ok || result.photoPath == null) return false
    const savedAt = new Date().toISOString()
    const record = buildScanRecord(result.cells, finalGrid, result.quad, savedAt)
    const folder = new Directory(Paths.document, FOLDER, savedAt.replace(/[:.]/g, '-'))
    folder.create({ intermediates: true })
    new File(fileUri(result.photoPath)).copy(new File(folder, 'photo.jpg'))
    if (result.flatPath != null) new File(fileUri(result.flatPath)).copy(new File(folder, 'flat.png'))
    const json = new File(folder, 'scan.json')
    json.create()
    json.write(JSON.stringify(record, null, 2))
    return true
  } catch (error) {
    devWarn('scan', `the scan is not saved: ${errorMessage(error)}`)
    return false
  }
}
