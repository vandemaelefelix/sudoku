import { SCAN_RETENTION_DAYS } from '../api/src/tableDesign.ts'

// ADR-030. The photos of the scan collection: private, encrypted, and gone after 12 months.
// A scan row expires after the same days (SCAN_RETENTION_DAYS), so the photo and the row expire on the same schedule.
export const scansBucket = new sst.aws.Bucket('ScansBucket', {
  lifecycle: [{ id: 'expire-scan-photos', expiresIn: `${SCAN_RETENTION_DAYS} days` }],
})

// SSE-S3 is the S3 default. This resource states it, so a reader sees that the bucket is encrypted.
// oxlint-disable-next-line eslint/no-new -- A Pulumi resource registers itself in its constructor.
new aws.s3.BucketServerSideEncryptionConfiguration('ScansBucketEncryption', {
  bucket: scansBucket.name,
  rules: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: 'AES256' } }],
})
