// ADR-030. The photos of the scan collection: private, encrypted, and gone after 12 months.
// A row expires after 365 days (backend/api/src/scans/store.ts), so the photo expires on the same schedule.
export const scansBucket = new sst.aws.Bucket('ScansBucket', {
  lifecycle: [{ id: 'expire-scan-photos', expiresIn: '365 days' }],
})

// SSE-S3 is the S3 default. This resource states it, so a reader sees that the bucket is encrypted.
// oxlint-disable-next-line eslint/no-new -- A Pulumi resource registers itself in its constructor.
new aws.s3.BucketServerSideEncryptionConfiguration('ScansBucketEncryption', {
  bucket: scansBucket.name,
  rules: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: 'AES256' } }],
})
