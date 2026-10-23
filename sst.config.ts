// oxlint-disable-next-line typescript/triple-slash-reference -- SST forbids top-level imports here. The editor needs this file for the SST globals.
/// <reference path="./.sst/platform/config.d.ts" />

// SST forbids top-level imports in this file, so app() and run() import dynamically.
export default $config({
  async app(input) {
    const { AWS_REGION, STAGES } = await import('./backend/infra/config.ts')
    const { APP_NAME } = await import('./backend/kill-switch/src/flag.ts')
    const { isStage } = await import('./backend/infra/account.ts')
    const stage = input?.stage
    if (!stage || !isStage(stage)) {
      throw new Error(`Unknown stage "${stage}". Use one of: ${STAGES.join(', ')}.`)
    }
    const inCi = process.env.GITHUB_ACTIONS === 'true'
    if (!inCi) {
      // Layer 2 of the account guard. SST prefers AWS_* variables over the profile below,
      // so an employer profile in the shell could otherwise reach a deploy.
      const profile = process.env.AWS_PROFILE
      if (process.env.AWS_ACCESS_KEY_ID || (profile && profile !== 'sudoku')) {
        throw new Error(
          'Unset AWS_PROFILE and AWS_ACCESS_KEY_ID, or use just deploy-api. The backend uses only the profile sudoku.',
        )
      }
    }
    return {
      name: APP_NAME,
      home: 'aws',
      version: '4.17.2',
      removal: stage === 'production' ? 'retain' : 'remove',
      protect: stage === 'production',
      providers: {
        aws: {
          region: AWS_REGION,
          ...(inCi ? {} : { profile: 'sudoku' }),
          defaultTags: { tags: { project: APP_NAME, stage } },
        },
      },
    }
  },
  async run() {
    // Layer 3 of the account guard. It runs before any resource, also in CI.
    const { assertKnownStage, assertPersonalAccount } = await import('./backend/infra/account.ts')
    const stage = assertKnownStage($app.stage)
    await assertPersonalAccount()
    // Layer 4: a plain `sst deploy` or `sst dev` also refuses a stopped stage. `remove` and `diff` pass (ADR-027, decision 9).
    const { assertNotStopped } = await import('./backend/infra/kill-switch-guard.ts')
    await assertNotStopped($app.stage, $cli.command)
    // Throws for felix and dev without an issuer, before any resource exists (their table has no deletion protection).
    const { deployPlan } = await import('./backend/infra/config.ts')
    const plan = deployPlan(stage)
    await import('./backend/infra/defaults.ts')
    await import('./backend/infra/budget.ts')
    const { deployRoles } = await import('./backend/infra/github-oidc.ts')
    // The account-wide resources of this stage are in budget.ts. Production without a Clerk issuer stops here.
    if (!plan.app) {
      console.log(
        `Stage ${$app.stage} has no Clerk issuer. It deploys only its account-wide resources and skips the table, the function and the API. Set CLERK_ISSUER in backend/infra/config.ts to deploy them.`,
      )
      return { ...deployRoles }
    }
    await import('./backend/infra/clerk.ts')
    await import('./backend/infra/storage.ts')
    const { api } = await import('./backend/infra/api.ts')
    await import('./backend/infra/scans.ts')
    return { apiUrl: api.url, ...deployRoles }
  },
})
