import { CLERK_ISSUER, type Stage } from './config.ts'

// run() checks the stage before it imports this file.
const stage = $app.stage as Stage

// Only a stage with a Clerk instance declares the key. A declared secret without a value stops the deploy,
// so production keeps deploying until it has its own instance.
export const clerkSecretKey = CLERK_ISSUER[stage] === null ? undefined : new sst.Secret('ClerkSecretKey')
