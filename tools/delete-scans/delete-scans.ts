import { SCAN_PREFIX, contribPk, photoKey, userPk } from '../../backend/api/src/tableDesign.ts'

export interface ScanDb {
  scanSortKeys(pk: string): Promise<string[]>
  deleteRow(pk: string, sk: string): Promise<void>
}

export interface PhotoStore {
  delete(key: string): Promise<void>
}

export interface DeleteScansArgs {
  db: ScanDb
  photos: PhotoStore
  owner: string
  confirm: (count: number) => Promise<boolean>
}

// The owner is a contributor ID or a user ID. The two never collide, so the tool reads both partitions.
export async function deleteScans({
  db,
  photos,
  owner,
  confirm,
}: DeleteScansArgs): Promise<{ found: number; deleted: number }> {
  const pks = [contribPk(owner), userPk(owner)]
  const sortKeys = await Promise.all(pks.map((pk) => db.scanSortKeys(pk)))
  const scans = pks.flatMap((pk, i) => sortKeys[i].filter((sk) => sk.startsWith(SCAN_PREFIX)).map((sk) => ({ pk, sk })))
  if (scans.length === 0 || !(await confirm(scans.length))) return { found: scans.length, deleted: 0 }
  await Promise.all(
    scans.map(async ({ pk, sk }) => {
      // The photo goes first: a failed photo delete leaves the row, so a retry still finds the scan.
      await photos.delete(photoKey(sk.slice(SCAN_PREFIX.length)))
      await db.deleteRow(pk, sk)
    }),
  )
  return { found: scans.length, deleted: scans.length }
}
