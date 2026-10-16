import { TABLE } from '../api/src/tableDesign.ts'
import { pointInTimeRecovery } from './backend-settings.ts'

// One on-demand table for the whole backend (ADR-027 decision 6). The rows are in ADR-028 decision 9.
export const table = new sst.aws.Dynamo('SyncTable', {
  fields: TABLE.fields,
  primaryIndex: TABLE.primaryIndex,
  localIndexes: TABLE.localIndexes,
  ttl: TABLE.ttl,
  deletionProtection: $app.stage === 'production',
  transform: {
    table: (args) => {
      args.pointInTimeRecovery = pointInTimeRecovery($app.stage)
    },
  },
})
