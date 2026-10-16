import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'dynamodb'])

// Refuses any endpoint but DynamoDB Local, so a test can never write to the AWS account.
export default async function setup(): Promise<void> {
  const endpoint = process.env.DYNAMODB_ENDPOINT
  if (!endpoint) {
    throw new Error('DYNAMODB_ENDPOINT is not set. Run the DB tests with: just test-api')
  }
  const { hostname } = new URL(endpoint)
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`DYNAMODB_ENDPOINT must point to DynamoDB Local, not to ${hostname}.`)
  }
  const client = new DynamoDBClient({
    endpoint,
    region: 'eu-west-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  })
  try {
    await client.send(new ListTablesCommand({ Limit: 1 }))
  } catch {
    throw new Error(`DynamoDB Local does not answer at ${endpoint}. Start it with: just dynamodb-up`)
  } finally {
    client.destroy()
  }
}
