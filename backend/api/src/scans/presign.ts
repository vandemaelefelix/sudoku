import { DeleteObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const URL_SECONDS = 15 * 60

export interface PhotoStore {
  // The signed headers include content-type and content-length: S3 refuses a PUT of another type or size.
  presignPut(key: string, bytes: number): Promise<string>
  // S3 answers 204 for a key that does not exist, so a retry is safe.
  delete(key: string): Promise<void>
}

export function createPhotoStore(client: Pick<S3Client, 'send' | 'config'>, bucket: string): PhotoStore {
  return {
    presignPut: (key, bytes) =>
      getSignedUrl(
        client as S3Client,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'image/jpeg', ContentLength: bytes }),
        {
          expiresIn: URL_SECONDS,
          signableHeaders: new Set(['content-type', 'content-length']),
        },
      ),
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
  }
}
