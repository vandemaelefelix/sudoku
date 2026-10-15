import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const here = dirname(fileURLToPath(import.meta.url))
const policyPath = join(here, '..', 'docs', 'privacy', 'privacy-policy.md')
const outDir = join(here, 'dist')

export const CONTACT = 'vandemaelefelix@gmail.com'

// The policy is the only source of the privacy page. The front matter and the comments are internal notes.
export function stripInternalNotes(markdown) {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
}

// Cobalt light colours from apps/mobile/src/theme/themes/cobalt/palette.ts. Contrast of ink and accent on the page is above 7:1.
const css = `
:root{color-scheme:light;--ink:#0f1d5c;--muted:#4f5a9a;--accent:#1f3fd1;--bg:#f4f6ff;--tint:#e3e8ff;--line:#c3cbef}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:1.0625rem/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,main,footer{max-width:42rem;margin:0 auto;padding:1rem}
header a.brand{color:var(--ink);font-weight:700;text-decoration:none}
a{color:var(--accent);text-underline-offset:.15em}
a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
h1{font-size:2.25rem;line-height:1.2;margin:1.5rem 0 1rem}
h2{font-size:1.4rem;margin:2rem 0 .5rem}
.lead{font-size:1.25rem}
table{border-collapse:collapse;width:100%}
.table-wrap{overflow-x:auto}
th,td{border:1px solid var(--line);padding:.5rem;text-align:left;vertical-align:top}
th{background:var(--tint)}
footer{color:var(--muted);border-top:1px solid var(--line);margin-top:3rem}
footer a{color:var(--accent)}
`.replace(/\n/g, '')

const page = ({ title, description, body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<style>${css}</style>
</head>
<body>
<header><a class="brand" href="/">Sudoku</a></header>
<main>
${body}
</main>
<footer><a href="/privacy">Privacy policy</a> &middot; <a href="mailto:${CONTACT}">${CONTACT}</a></footer>
</body>
</html>
`

export async function build() {
  const policy = stripInternalNotes(await readFile(policyPath, 'utf8'))
  const privacyBody = marked
    .parse(policy, { async: false })
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>')

  await rm(outDir, { recursive: true, force: true })
  await mkdir(join(outDir, 'privacy'), { recursive: true })

  const home = `<h1>Sudoku</h1>
<p class="lead">An ad-free sudoku game for iPhone. Scan a paper puzzle with the camera and play it, solve it or get a hint.</p>
<p>An account is optional. It backs up your finished games.</p>
<p><a href="/privacy">Privacy policy</a></p>
<p>Contact: <a href="mailto:${CONTACT}">${CONTACT}</a></p>`

  await writeFile(
    join(outDir, 'index.html'),
    page({
      title: 'Sudoku',
      description: 'An ad-free sudoku game for iPhone with a paper puzzle scanner.',
      body: home,
    }),
  )
  await writeFile(
    join(outDir, 'privacy', 'index.html'),
    page({
      title: 'Privacy policy of Sudoku',
      description: 'The privacy policy of the Sudoku app.',
      body: privacyBody,
    }),
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build()
