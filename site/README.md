# The Sudoku site

A static home page and privacy page. Vercel hosts it at <https://sudoku.felixvandemaele.be>.
The page `/privacy` is built from [`docs/privacy/privacy-policy.md`](../docs/privacy/privacy-policy.md).
That file is the only source. Edit the policy there, not here.

## Build locally

```bash
pnpm install
pnpm --filter @sudoku/site build   # writes site/dist/ (git-ignored)
pnpm --filter @sudoku/site test
```

The site has no JavaScript, no cookies, no analytics and no third-party request (SUD-02).
Nothing in `apps/` or `packages/` imports this folder.

## Vercel setup (the developer only)

1. In Vercel, use your personal Hobby team. Choose **Add New, Project**. Import the GitHub repository `vandemaelefelix/sudoku`.
2. Set **Root Directory** to `site`. Set **Framework Preset** to `Other`. Keep the build command and the output
   directory from `vercel.json`.
3. Set the **Production Branch** to `develop` (the integration branch), or `main` when you release from it.
4. Deploy. Then open **Settings, Domains**. Add `sudoku.felixvandemaele.be`. The DNS is on Vercel already, so
   Vercel adds the record itself.
5. Open `https://sudoku.felixvandemaele.be` and `https://sudoku.felixvandemaele.be/privacy`. Check both pages.
6. In Google Cloud, open the OAuth consent screen, **Branding**. Enter `https://sudoku.felixvandemaele.be` as the home
   page and `https://sudoku.felixvandemaele.be/privacy` as the privacy policy.

Check the policy again before the App Store submission.
