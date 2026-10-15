import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ACTUAL_ALERT_USD, BUDGET_LIMIT_USD, FORECAST_ALERT_USD, budgetNotifications } from './budget-alerts.ts'

describe('budgetNotifications', () => {
  const notifications = budgetNotifications('player@example.com')

  it('alerts at $3 forecast and at $6 actual, under the $10 limit (SUD-11)', () => {
    assert.deepEqual(
      notifications.map((n) => [n.notificationType, n.threshold]),
      [
        ['FORECASTED', 3],
        ['ACTUAL', 6],
      ],
    )
    assert.equal(FORECAST_ALERT_USD, 3)
    assert.equal(ACTUAL_ALERT_USD, 6)
    assert.equal(BUDGET_LIMIT_USD, 10)
  })

  it('compares absolute amounts', () => {
    for (const n of notifications) {
      assert.equal(n.comparisonOperator, 'GREATER_THAN')
      assert.equal(n.thresholdType, 'ABSOLUTE_VALUE')
    }
  })

  it('emails the given address on every alert', () => {
    for (const n of notifications) assert.deepEqual(n.subscriberEmailAddresses, ['player@example.com'])
  })
})
