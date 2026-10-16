// The thresholds of ADR-027 decision 9. The alerts warn well before the SUD-11 cap.
export const BUDGET_LIMIT_USD = 10
export const FORECAST_ALERT_USD = 3
export const ACTUAL_ALERT_USD = 6
export const KILL_SWITCH_USD = 9

// The alerts compare the spend before credits and refunds. A credit must not hide a cost spike (SUD-11).
export const BUDGET_COST_TYPES = { includeCredit: false, includeRefund: false } as const

export interface BudgetNotification<T, U> {
  comparisonOperator: 'GREATER_THAN'
  threshold: number
  thresholdType: 'ABSOLUTE_VALUE'
  notificationType: 'FORECASTED' | 'ACTUAL'
  subscriberEmailAddresses: T[]
  subscriberSnsTopicArns?: U[]
}

// Generic over the address and the topic ARN, so the tests pass strings and budget.ts passes Outputs.
export function budgetNotifications<T, U>(email: T, killSwitchTopicArn: U): BudgetNotification<T, U>[] {
  const alert = (notificationType: 'FORECASTED' | 'ACTUAL', threshold: number): BudgetNotification<T, U> => ({
    comparisonOperator: 'GREATER_THAN',
    threshold,
    thresholdType: 'ABSOLUTE_VALUE',
    notificationType,
    subscriberEmailAddresses: [email],
  })
  // The direct email stays on the $9 alert, so a crash of the kill switch still warns the developer.
  return [
    alert('FORECASTED', FORECAST_ALERT_USD),
    alert('ACTUAL', ACTUAL_ALERT_USD),
    { ...alert('ACTUAL', KILL_SWITCH_USD), subscriberSnsTopicArns: [killSwitchTopicArn] },
  ]
}
