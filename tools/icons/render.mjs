import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIcons, renderPng } from './icons.mjs'

const OUT = new URL('../../mobile/assets/icons/', import.meta.url)

for (const icon of buildIcons()) {
  const target = fileURLToPath(new URL(icon.file, OUT))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, renderPng(icon).png)
  console.log(`${icon.file} (${icon.size} px)`)
}
