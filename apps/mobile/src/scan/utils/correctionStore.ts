import { Directory, File, Paths } from 'expo-file-system'
import type { RecogniseResult } from '@/scanner'
import { devWarn, errorMessage } from '@/utils/log.utils'
import type { CellLook } from './correction.utils'
import { buildScanRecord } from './correctionLog.utils'
import { flatToPng } from './flatImage.utils'

const FOLDER = 'scan-corrections'

/**
 * Saves a scan with the corrections of the player as Documents/scan-corrections/<time>/: photo.jpg (upright), flat.png (the grid the
 * cells were cut from) and scan.json. The files stay on the phone until the developer copies them (SUD-02). Returns false, and never
 * throws, when the scan cannot be saved: the screen shows that.
 */
export async function saveScanCorrection(result: RecogniseResult | null, looks: readonly CellLook[]): Promise<boolean> {
  try {
    if (result == null || !result.ok || result.photoPath == null) return false
    const savedAt = new Date().toISOString()
    const record = buildScanRecord(result.cells, looks, result.quad, savedAt)
    const folder = new Directory(Paths.document, FOLDER, savedAt.replace(/[:.]/g, '-'))
    folder.create({ intermediates: true })
    const photo = result.photoPath.startsWith('file:') ? result.photoPath : `file://${result.photoPath}`
    new File(photo).copy(new File(folder, 'photo.jpg'))
    if (result.flat) {
      const flat = new File(folder, 'flat.png')
      flat.create()
      flat.write(flatToPng(result.flat))
    }
    const json = new File(folder, 'scan.json')
    json.create()
    json.write(JSON.stringify(record, null, 2))
    return true
  } catch (error) {
    devWarn('scan', `the scan is not saved: ${errorMessage(error)}`)
    return false
  }
}
