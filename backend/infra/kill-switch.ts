import { STAGES } from './config.ts'
import { LOG_DELIVERY_ACTIONS } from './kill-switch-settings.ts'

// The account-wide kill switch (ADR-027, decision 9). The caller runs this only on ACCOUNT_STAGE.
// The Lambda finds the other stages at run time, because it cannot hold their ARNs at deploy time.
export function createKillSwitch(email: $util.Input<string>): { topicArn: $util.Output<string> } {
  const accountId = aws.getCallerIdentityOutput().accountId

  // A topic with no KMS key, because AWS Budgets cannot use a key that it has no access to.
  const budgetTopic = new sst.aws.SnsTopic('KillSwitchTopic')
  // oxlint-disable-next-line eslint/no-new -- A Pulumi resource registers itself in its constructor.
  new aws.sns.TopicPolicy('KillSwitchTopicPolicy', {
    arn: budgetTopic.arn,
    policy: $jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AccountOwner',
          Effect: 'Allow',
          Principal: { AWS: '*' },
          Action: ['SNS:Publish', 'SNS:Subscribe', 'SNS:GetTopicAttributes', 'SNS:SetTopicAttributes'],
          Resource: budgetTopic.arn,
          Condition: { StringEquals: { 'AWS:SourceOwner': accountId } },
        },
        {
          Sid: 'AwsBudgets',
          Effect: 'Allow',
          Principal: { Service: 'budgets.amazonaws.com' },
          Action: 'SNS:Publish',
          Resource: budgetTopic.arn,
          Condition: {
            StringEquals: { 'aws:SourceAccount': accountId },
            ArnLike: { 'aws:SourceArn': $interpolate`arn:aws:budgets::${accountId}:*` },
          },
        },
      ],
    }),
  })

  // The Lambda sends the readable summary here. The budget also emails the developer directly,
  // so a crash of the Lambda still warns (two emails per alert are accepted).
  const alertTopic = new sst.aws.SnsTopic('KillSwitchAlertTopic')
  // oxlint-disable-next-line eslint/no-new -- A Pulumi resource registers itself in its constructor.
  new aws.sns.TopicSubscription('KillSwitchAlertEmail', {
    topic: alertTopic.arn,
    protocol: 'email',
    endpoint: email,
  })

  budgetTopic.subscribe('KillSwitch', {
    handler: 'backend/kill-switch/src/handler.handler',
    environment: { STAGES: STAGES.join(','), ALERT_TOPIC_ARN: alertTopic.arn },
    permissions: [
      {
        actions: ['apigateway:GET', 'apigateway:PATCH'],
        resources: ['arn:aws:apigateway:*::/apis', 'arn:aws:apigateway:*::/apis/*'],
      },
      { actions: [...LOG_DELIVERY_ACTIONS], resources: ['*'] },
      { actions: ['lambda:ListFunctions'], resources: ['*'] },
      {
        actions: ['lambda:PutFunctionConcurrency'],
        resources: [$interpolate`arn:aws:lambda:*:${accountId}:function:sudoku-*`],
      },
      {
        actions: ['ssm:PutParameter'],
        resources: [$interpolate`arn:aws:ssm:*:${accountId}:parameter/sudoku/kill-switch/*`],
      },
      { actions: ['sns:Publish'], resources: [alertTopic.arn] },
    ],
  })

  return { topicArn: budgetTopic.arn }
}
