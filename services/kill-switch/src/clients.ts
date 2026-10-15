import { ApiGatewayV2Client } from '@aws-sdk/client-apigatewayv2'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { SNSClient } from '@aws-sdk/client-sns'
import { SSMClient } from '@aws-sdk/client-ssm'
import type { AwsClients } from './aws.ts'

// Module scope in the Lambda: a warm start reuses the clients. infra/api-on.ts builds them in the same way.
export function createClients(region?: string): AwsClients {
  const config = region ? { region } : {}
  return {
    apigw: new ApiGatewayV2Client(config),
    lambda: new LambdaClient(config),
    ssm: new SSMClient(config),
    sns: new SNSClient(config),
  }
}
