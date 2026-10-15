// oxlint-disable-next-line typescript/triple-slash-reference -- SST forbids top-level imports here. The editor needs this file for the SST globals.
/// <reference path="./.sst/platform/config.d.ts" />

// SST forbids top-level imports in this file, so app() and run() import dynamically.
export default $config({
  async app(input) {
    const { AWS_REGION, STAGES } = await import('./infra/config.ts')
    const { isStage } = await import('./infra/account.ts')
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
      name: 'sudoku',
      home: 'aws',
      version: '4.17.2',
      removal: stage === 'production' ? 'retain' : 'remove',
      protect: stage === 'production',
      providers: {
        aws: {
          region: AWS_REGION,
          ...(inCi ? {} : { profile: 'sudoku' }),
          defaultTags: { tags: { project: 'sudoku', stage } },
        },
      },
    }
  },
  async run() {
    // Layer 3 of the account guard. It runs before any resource, also in CI.
    const { assertKnownStage, assertPersonalAccount } = await import('./infra/account.ts')
    assertKnownStage($app.stage)
    await assertPersonalAccount()
    await import('./infra/defaults.ts')
    await import('./infra/budget.ts')
  },
})
