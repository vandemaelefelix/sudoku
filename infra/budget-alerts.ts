// The thresholds of ADR-027 decision 9. The alerts warn well before the SUD-11 cap.
export const BUDGET_LIMIT_USD = 10
export const FORECAST_ALERT_USD = 3
export const ACTUAL_ALERT_USD = 6

// The alerts compare the spend before credits and refunds. A credit must not hide a cost spike (SUD-11).
export const BUDGET_COST_TYPES = { includeCredit: false, includeRefund: false } as const

export interface BudgetNotification<T> {
  comparisonOperator: 'GREATER_THAN'
  threshold: number
  thresholdType: 'ABSOLUTE_VALUE'
  notificationType: 'FORECASTED' | 'ACTUAL'
  subscriberEmailAddresses: T[]
}

// Generic over the address, so the tests pass a string and budget.ts passes the secret's Output.
export function budgetNotifications<T>(email: T): BudgetNotification<T>[] {
  const alert = (notificationType: 'FORECASTED' | 'ACTUAL', threshold: number): BudgetNotification<T> => ({
    comparisonOperator: 'GREATER_THAN',
    threshold,
    thresholdType: 'ABSOLUTE_VALUE',
    notificationType,
    subscriberEmailAddresses: [email],
  })
  return [alert('FORECASTED', FORECAST_ALERT_USD), alert('ACTUAL', ACTUAL_ALERT_USD)]
}
