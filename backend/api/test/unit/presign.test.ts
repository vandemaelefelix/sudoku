import { S3Client } from '@aws-sdk/client-s3'
import { describe, expect, it } from 'vitest'
import { createPhotoStore } from '../../src/scans/presign'

describe('createPhotoStore', () => {
  const client = new S3Client({ region: 'eu-west-1', credentials: { accessKeyId: 'a', secretAccessKey: 'b' } })
  const store = createPhotoStore(client, 'bucket-1')

  it('signs a PUT for the photo key with the JPEG content type and the photo length', async () => {
    const url = new URL(await store.presignPut('scans/s-1.jpg', 123_456))
    expect(url.hostname).toContain('bucket-1')
    expect(url.pathname).toBe('/scans/s-1.jpg')
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy()
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length')
    expect(Number(url.searchParams.get('X-Amz-Expires'))).toBeLessThanOrEqual(3600)
  })
})
