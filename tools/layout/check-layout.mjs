// SUD-12: the root holds only the entries that ADR-029 lists.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const FOLDERS = new Set(['.github', 'backend', 'docs', 'ml', 'mobile', 'shared', 'tools', 'web'])
const FILES = new Set([
  '.dependency-cruiser.cjs',
  '.envrc',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  '.oxfmtrc.json',
  '.oxlintrc.json',
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'justfile',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'sst.config.ts',
  'tsconfig.base.json',
  'tsconfig.boundaries.json',
  'tsconfig.infra.json',
])

export function unexpectedEntries(trackedPaths) {
  const entries = new Set(trackedPaths.filter(Boolean).map((path) => path.split('/')[0]))
  return [...entries].filter((entry) => !FOLDERS.has(entry) && !FILES.has(entry)).toSorted()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n')
  const bad = unexpectedEntries(tracked)
  if (bad.length > 0) {
    console.error(`Unexpected root entries: ${bad.join(', ')}. Write an ADR first (SUD-12, ADR-029).`)
    process.exit(1)
  }
}
