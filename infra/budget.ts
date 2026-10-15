import { BUDGET_COST_TYPES, BUDGET_LIMIT_USD, budgetNotifications } from './budget-alerts.ts'
import { ACCOUNT_STAGE } from './config.ts'
import { createKillSwitch } from './kill-switch.ts'

// The budget covers the whole account, with no cost filter: the account holds only this project (SUD-11).
// A direct email subscriber needs no confirmation. Forecast alerts start after some weeks of cost history.
if ($app.stage === ACCOUNT_STAGE) {
  const email = new sst.Secret('BudgetEmail')
  const { topicArn } = createKillSwitch(email.value)
  // oxlint-disable-next-line eslint/no-new -- A Pulumi resource registers itself in its constructor.
  new aws.budgets.Budget('MonthlyCost', {
    name: 'sudoku-monthly-cost',
    budgetType: 'COST',
    limitAmount: String(BUDGET_LIMIT_USD),
    limitUnit: 'USD',
    timeUnit: 'MONTHLY',
    costTypes: BUDGET_COST_TYPES,
    notifications: budgetNotifications(email.value, topicArn),
  })
}
