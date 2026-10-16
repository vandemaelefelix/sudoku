// Usage: node tools/delete-scans/cli.ts <table> <bucket> <contributorId|userId>. Run it through `just delete-scans`.
import { createInterface } from 'node:readline/promises'
import { createRequire } from 'node:module'

import { deleteScans } from './delete-scans.ts'

const [table, bucket, owner] = process.argv.slice(2)
if (!table || !bucket || !owner) {
  console.error('Usage: just delete-scans <table> <bucket> <contributorId|userId>')
  process.exit(2)
}

// The AWS SDK is a dependency of backend/api only.
const require = createRequire(new URL('../../backend/api/package.json', import.meta.url))
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb')
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const s3 = new S3Client({})

const db = {
  async scanSortKeys(pk: string) {
    const sks: string[] = []
    let start: Record<string, unknown> | undefined
    do {
      // oxlint-disable-next-line eslint/no-await-in-loop -- each page needs the key that the previous page returned
      const page = await doc.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
          ExpressionAttributeValues: { ':pk': pk, ':p': 'SCAN#' },
          ProjectionExpression: 'sk',
          ExclusiveStartKey: start,
        }),
      )
      for (const item of page.Items ?? []) sks.push(item.sk)
      start = page.LastEvaluatedKey
    } while (start)
    return sks
  },
  async deleteRow(pk: string, sk: string) {
    await doc.send(new DeleteCommand({ TableName: table, Key: { pk, sk } }))
  },
}
const photos = {
  async delete(key: string) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  },
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
const result = await deleteScans({
  db,
  photos,
  owner,
  confirm: async (count) =>
    (await rl.question(`Delete ${count} scan(s) of ${owner} from ${table}? [y/N] `)).trim().toLowerCase() === 'y',
})
rl.close()
console.log(`Found ${result.found} scan(s). Deleted ${result.deleted}.`)
