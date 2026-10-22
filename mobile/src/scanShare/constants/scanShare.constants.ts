/** SettingsRepository keys of the scan sharing (ADR-030). */
export const SHARE_SCANS_KEY = 'app.shareScans'
export const NOTICE_SEEN_KEY = 'app.shareScansNoticeSeen'
export const CONTRIBUTOR_ID_KEY = 'app.contributorId'

/** The grid bounding box grows by this share of its side on each side, so the pull step can find the grid again. */
export const CROP_MARGIN = 0.08
/** Pixels. The longest side of the uploaded photo. */
export const MAX_PHOTO_SIDE = 1600
/** The first JPEG quality, from 0 to 1. A photo over MAX_JPEG_BYTES is encoded again with the next one. */
export const JPEG_QUALITIES: readonly number[] = [0.85, 0.7, 0.55, 0.4]

/** The header that carries the shared app key. The key is not a secret (SUD-11). */
export const APP_KEY_HEADER = 'x-app-key'
/** The header that carries the photo length in bytes. The route signs it into the upload URL. */
export const JPEG_BYTES_HEADER = 'x-jpeg-bytes'
export const REQUEST_TIMEOUT_MS = 30_000
export const UPLOAD_TIMEOUT_MS = 60_000

export const BACKOFF_BASE_MS = 60_000
/** The backoff stops growing here, so a phone that was offline for days still tries a few times a day. */
export const BACKOFF_MAX_MS = 6 * 60 * 60_000

export const QUEUE_DATABASE_NAME = 'scan-queue.db'
export const QUEUE_FOLDER = 'scan-queue'
export const POLICY_URL = 'https://sudoku.felixvandemaele.be/privacy'

