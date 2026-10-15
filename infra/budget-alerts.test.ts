import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ACTUAL_ALERT_USD,
  BUDGET_COST_TYPES,
  BUDGET_LIMIT_USD,
  FORECAST_ALERT_USD,
  KILL_SWITCH_USD,
  budgetNotifications,
} from './budget-alerts.ts'

describe('budgetNotifications', () => {
  const notifications = budgetNotifications('player@example.com', 'arn:topic')

  it('alerts at $3 forecast, at $6 actual and at $9 actual for the kill switch, under the $10 limit (SUD-11)', () => {
    assert.deepEqual(
      notifications.map((n) => [n.notificationType, n.threshold]),
      [
        ['FORECASTED', 3],
        ['ACTUAL', 6],
        ['ACTUAL', 9],
      ],
    )
  })

  it('compares absolute amounts', () => {
    for (const n of notifications) {
      assert.equal(n.comparisonOperator, 'GREATER_THAN')
      assert.equal(n.thresholdType, 'ABSOLUTE_VALUE')
    }
  })

  it('sends only the $9 alert to the kill-switch topic', () => {
    assert.deepEqual(
      notifications.map((n) => n.subscriberSnsTopicArns),
      [undefined, undefined, ['arn:topic']],
    )
  })

  it('orders the thresholds below the limit', () => {
    assert.ok(FORECAST_ALERT_USD < ACTUAL_ALERT_USD)
    assert.ok(ACTUAL_ALERT_USD < KILL_SWITCH_USD)
    assert.ok(KILL_SWITCH_USD < BUDGET_LIMIT_USD)
  })

  it('emails the given address on every alert', () => {
    for (const n of notifications) assert.deepEqual(n.subscriberEmailAddresses, ['player@example.com'])
  })
})

describe('BUDGET_COST_TYPES', () => {
  it('counts the spend before credits and refunds, so a credit cannot hide it from the alerts', () => {
    assert.equal(BUDGET_COST_TYPES.includeCredit, false)
    assert.equal(BUDGET_COST_TYPES.includeRefund, false)
  })
})
