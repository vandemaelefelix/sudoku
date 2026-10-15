// oxlint-disable-next-line typescript/triple-slash-reference -- SST forbids top-level imports here. The editor needs this file for the SST globals.
/// <reference path="./.sst/platform/config.d.ts" />

// SST forbids top-level imports in this file. These must equal STAGES and AWS_REGION in infra/config.ts.
// run() checks the stage against infra/config.ts.
const STAGES = ['felix', 'dev', 'production']
const REGION = 'eu-west-1'

export default $config({
  app(input) {
    const stage = input?.stage
    if (!stage || !STAGES.includes(stage)) {
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
          region: REGION,
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
  },
})
