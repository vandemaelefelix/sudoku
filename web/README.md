# The Sudoku site

A static home page and privacy page. Vercel hosts it at <https://sudoku.felixvandemaele.be>.
The page `/privacy` is built from [`docs/privacy/privacy-policy.md`](../docs/privacy/privacy-policy.md).
That file is the only source. Edit the policy there, not here.

## Build locally

```bash
pnpm install
pnpm --filter @sudoku/web build   # writes web/dist/ (git-ignored)
pnpm --filter @sudoku/web test
```

The site has no JavaScript, no cookies and no analytics (SUD-02). Pages load no third-party resource.
Vercel hosts the site. Vercel processes the IP address of a visitor to serve the pages. The policy says so.
Nothing in `apps/` or `packages/` imports this folder.

## Vercel setup (the developer only)

1. In Vercel, use your personal Hobby team. Choose **Add New, Project**. Import the GitHub repository `vandemaelefelix/sudoku`.
2. Set these project settings. They must match `vercel.json`.

   | Setting | Value |
   | --- | --- |
   | Root Directory | `web` |
   | Include source files outside of the Root Directory | On. The build reads `docs/privacy/privacy-policy.md`. |
   | Framework Preset | `Other` |
   | Install Command | `pnpm install --frozen-lockfile --filter @sudoku/web...` |
   | Build Command | `node build.mjs` |
   | Output Directory | `dist` |
   | Environment variable | `ENABLE_EXPERIMENTAL_COREPACK=1`. Vercel then uses the pnpm version of the root `packageManager`. |

3. Set the **Production Branch** to `develop` (the integration branch), or `main` when you release from it.
4. Deploy. Vercel also deploys a preview for every pull request branch. Then open **Settings, Domains**. Add `sudoku.felixvandemaele.be`. The DNS is on Vercel already, so
   Vercel adds the record itself.
5. Open `https://sudoku.felixvandemaele.be` and `https://sudoku.felixvandemaele.be/privacy`. Check both pages.
6. In Google Cloud, open the OAuth consent screen, **Branding**. Enter `https://sudoku.felixvandemaele.be` as the home
   page and `https://sudoku.felixvandemaele.be/privacy` as the privacy policy.

Check the policy again before the App Store submission.
