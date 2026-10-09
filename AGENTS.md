# AGENTS.md

Instructions for every coding agent that works in this repository. Claude Code reads this file
through `CLAUDE.md`. Other agents read it directly. Keep all shared instructions here, not in a
tool-specific file.

## Project

An ad-free iOS sudoku game. It can scan a paper sudoku with the camera, recognise printed and
handwritten digits on the device, and load the puzzle to play, solve or get a hint.

- **Status:** milestone M0 (walking skeleton). The repository is scaffolded. Work on an issue
  only after its implementation plan is approved.
- **Goal:** learning and portfolio first. It also replaces an ad-heavy sudoku app. An App Store
  release is possible, not a goal.

## Where to look first

| Need | File |
| --- | --- |
| What we build and why | `docs/architecture/01-introduction-and-goals.md` |
| Every binding rule and decision | `docs/architecture/00-DECISIONS.md` |
| Repository layout and boundaries | `docs/architecture/05-building-block-view.md` |
| How a scan works | `docs/architecture/00-concepts/scan-pipeline.md` |
| What the model must accept and return | `docs/architecture/00-concepts/model-contract.md` |
| Words and their meaning | `docs/architecture/12-glossary.md` |
| Commands (setup, test, lint) | `justfile`, or run `just --list` |
| Rules for the Expo app | `apps/mobile/AGENTS.md` |

## Rules that bind all work

1. Obey every `SUD-xx` constraint in `00-DECISIONS.md`. If a change would break one, stop and
   say so. Do not work around it.
2. Do not change an accepted decision in code alone. Write or amend an ADR first.
3. `ml/` (Python) and the TypeScript side share files only: `contracts/`, `fixtures/` and the
   promoted model. Neither side imports the other (SUD-07).
4. Do not commit training images or private fixtures (SUD-08).
5. Do not let camera frames, photos or cell images leave the device without an explicit user
   action (SUD-02). No analytics, no tracking, no ads.

## Architecture documentation

The documentation follows Arc42.

- Chapters are numbered files in `docs/architecture/`: `01-` to `12-`.
- Each file starts with front matter: `status: DRAFT` or `status: ACCEPTED`.
- `00-DECISIONS.md` is an index. It holds one line per constraint or decision. The reasoning
  lives in the source that the row links to.
- ADRs live in `docs/architecture/adr/adr-NNN-<slug>.md`. Each ADR has a metadata table and these
  sections: Context, Alternatives Evaluated, Decision, Consequences, Reassessment Triggers.
- ADR status is `Proposed` until it is validated, then `Accepted`. To replace an ADR, write a new
  one that says "Supersedes ADR-NNN". Do not rewrite the old decision.
- Concepts live in `docs/architecture/00-concepts/`. Each has the sections Why, What, a diagram,
  Open questions and Constraints.
- Diagrams are Mermaid, inside the Markdown.
- When you add or change a decision, update `00-DECISIONS.md` and `09-architecture-decisions.md`
  in the same change.
- Check that every relative link resolves before you commit.

## Writing style: Simplified Technical English, light

All prose in this repository follows these rules. They come from ASD-STE100, made less strict so
that technical terms stay usable. Code comments, ADRs, concepts, commit messages and pull requests
all follow them.

1. **One word, one meaning.** Use the same word for the same thing every time. The glossary
   (`12-glossary.md`) is the dictionary. If you need a new term, add it to the glossary.
2. **Short sentences.** An instruction has 20 words or fewer. A description has 25 words or
   fewer.
3. **One instruction per sentence.** Do not join two steps with "and".
4. **Active voice.** Write "promote refuses the model", not "the model is refused".
5. **Simple verb forms.** Use the present, past and future, and commands. Avoid "-ing" forms and
   perfect tenses where a simple form works.
6. **One topic per paragraph.** A paragraph has six sentences or fewer.
7. **Lists and tables for complex text.** Use a vertical list for steps, options or conditions.
8. **Plain words.** Write "use", not "utilise". Write "start", not "commence". Write "before", not
   "prior to".
9. **Keep the articles.** Do not drop "the", "a" or "this" to save space.
10. **Warnings come first.** Put the command first, then the risk: "Do not delete `ml/data/`.
    It holds the only copy of the labelled cells."

Technical names (such as "frame processor" or "promote gate") are allowed. Define them in the
glossary.

## Work tracking

Work is tracked in GitHub issues. Use the `gh` CLI.

1. Every change starts from an issue. If no issue exists, propose one to the developer. Do not
   create it without approval.
2. Each issue has one `type:` label, one `area:` label and a milestone (`M0` to `M3`).
3. Use the templates in `.github/ISSUE_TEMPLATE/`. Acceptance criteria are a checklist.
4. Name the branch `<type>/<issue>-<slug>`, for example `feature/12-technique-solver`.
5. Reference the issue in commits, for example `feat(core): add naked singles (#12)`.
6. Put `Closes #<issue>` in the pull request body. Do not close issues by hand.
7. Tick an acceptance criterion in the issue when it is met.
8. Before a pull request is merged, a second agent reviews it without this session's context.
   Fix its findings, or answer them in the pull request.
9. When work proves or changes a decision, update the ADR in the same pull request and link it
   from the issue.

## Git

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, and so on.
- A model promotion is its own commit: `feat(model): cell-classifier 1.2.0, dev grid-exact 96 % → 97 %`.
- Do not commit or push unless the developer asks for it.
