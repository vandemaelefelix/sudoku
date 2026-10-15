import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BUDGET_COST_TYPES, budgetNotifications } from './budget-alerts.ts'

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

describe('BUDGET_COST_TYPES', () => {
  it('counts the spend before credits and refunds, so a credit cannot hide it from the alerts', () => {
    assert.equal(BUDGET_COST_TYPES.includeCredit, false)
    assert.equal(BUDGET_COST_TYPES.includeRefund, false)
  })
})
