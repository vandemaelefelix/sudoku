---
status: DRAFT
---

# ADR-034: A labelling app in Vite and React, with two flows, over the Python label server

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-22 |
| Contact | Felix      |

Amends [ADR-029](adr-029-repository-layout.md) decision 7: one more workspace glob. Replaces the labelling page of
[ADR-009](adr-009-training-data-outside-git.md) and [ADR-018](adr-018-one-data-folder-two-tables.md) and its screens.
Their data decisions stay: the journal, undo, Finish, the two tables and the image store.

## Context

The labelling page `ml/src/sudoku_ml/label_page.html` grew screen by screen to about 1,600 lines of hand-written
JavaScript in one file. Photos, cells and uploaded scans sat over seven tabs: Photos, Digits, Groups, Outlines, Cells,
Review, Check and Progress. The developer found the flows hard to follow. An Enter on Outlines approved every outline,
and nothing said what came next. On 2026-10-22 the developer decided to start the UI over with only what is needed.

The Python side holds the real work. `label_store.py`, `journal.py`, `finish.py` and the cut of a photo hold the rules,
the undo, the file moves and Finish. About 400 tests cover them. The developer had an unfinished journal open, with
outline approvals in it. A rewrite must not lose it.

SUD-07 says that `ml/` and the TypeScript side share files only. SUD-12 lets the root hold only the folders of ADR-029.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Keep the page and tidy it | No new tooling | One file without types, components or tests of its own. The flows stay mixed |
| **Vite + React + TypeScript in `tools/label-app/`, HTTP to the Python server** | Components and types. Vitest and Testing Library like the rest of the repo. The Python rules and their tests stay | A build step. A second language for the labelling tool |
| A Python UI (Streamlit, NiceGUI) inside `ml/` | One language in `ml/` | Weak keyboard control, a server round trip per click, no typed contract with the server |
| The page inside `mobile/` or `web/` | No new package | `mobile/` is the iOS app. `web/` is the public static site on Vercel. The labelling app must never leave the Mac (SUD-02) |

## Decision

1. **The app lives in `tools/label-app/`**, the pnpm package `@sudoku/label-app`. It uses Vite, React and TypeScript
   with exact versions. It has no router and no UI library: hash routes and plain CSS.
2. **It talks only HTTP to the label server.** `label_server.py` serves the built `tools/label-app/dist/` and the JSON
   API on 127.0.0.1 only. No Python file imports TypeScript, and no TypeScript file imports Python (SUD-07). The
   server reads the built files as static files, like a browser would.
3. **`ml/` stays Python only.** The rules of the labels, the journal and the cut stay in `ml/`, next to the data and
   the training that read them. The app holds no rule that the server does not check again.
4. **The API is typed on both sides.** `tools/label-app/src/api/types.ts` holds the TypeScript types.
   `ml/tests/api_schemas.py` holds the same shapes as JSON Schemas, and the server tests validate each answer against
   them. A change of one needs the same change in the other.
5. **A start page and two flows, nothing else.**
   - **Flow A, from sudoku photos:** Fetch new scans, Outlines, Cells per digit, Finish. Uploaded scans and imported
     photos share the steps. Cells per digit shows the open cells in one gallery per digit. A side panel shows the
     whole sudoku of the cell under the pointer. The developer asked for this on 2026-10-22: the grid tells a 1
     from a 7. The doubt score of #253 sets the order of this gallery later.
   - Flow A and Flow B share one gallery component per digit.
   - **Flow B, from loose cells:** Pre-label, Digits, Kind, Doubtful labels, Finish.
   - The Photos, Groups and Outlines tabs become steps. The Progress screen becomes the counts of the start page. The
     Check screen (the 7-day self-agreement test) is gone. Its data stays in `kind-checks.jsonl`.
6. **One key scheme.** Enter confirms, Z undoes, Escape goes back, digits and P, H, U label, and ? shows the keys of
   the step. Every step says in one sentence what to do. An empty step says why it is empty and what is next. Every
   action says what it did and what comes next.
7. **Fetch finds the stage itself.** The server lists the tables and buckets of the profile `sudoku` and takes the one
   table `sudoku-<stage>-SyncTableTable-*` and the one bucket `sudoku-<stage>-scansbucketbucket-*`. `production` is the
   default. An expired session answers 401 with `sign_in`. The app then offers **Sign in to AWS**, which starts
   `aws login --profile sudoku-login`, the command of `just aws-login`.
8. **The journal does not change.** The lines, their fields and their screen names stay. An unfinished journal of the
   old page loads in the app with no Finish and no migration. A server test covers it.
9. **`just label-cells` stays the one command.** It builds the app when a source is newer than the build, starts the
   server and opens the browser.
10. **ADR-029 decision 7 gets one more glob:** `tools/label-app`. The root does not change, so SUD-12 holds.

## Amendment: one flow (2026-10-22)

The first session in the app showed that two flows confuse. A loose cell and a scan cell need the same check. The
developer also wants the cells with the highest doubt first (see the amendment of
[ADR-030](adr-030-scan-collection.md)).

| Option | For | Against |
| --- | --- | --- |
| **One flow: Fetch new scans, Outlines, Digits, Kind, Finish** | One path to learn. Every open cell is in one list | The Digits step mixes cells with and without a photo |
| Keep two flows | Each flow is small | The developer has to know which flow holds a cell |

Decision (this replaces decision 5):

1. **The app has one flow:** Fetch new scans, Outlines, Digits, Kind, Finish.
   - The **Digits step** holds every open digit cell. This is an open cell of a scan with an approved outline, or a
     loose cell. A loose cell has no photo. Its side panel says "no photo".
   - The **Kind step** holds the cells of 1 to 9 whose digit a person confirmed, and the cells of 1 to 9 without a kind.
   - Both steps show the cell with the highest doubt first. A threshold button confirms the sure cells of one tab.
2. **The pre-label is automatic.** The server runs the latest model at its start, after a fetch and after each approved
   outline. It stores the probabilities of 10 digits and 4 kinds for each open cell, also for the cells in `empty/`. The
   start page shows a line when no model is installed. There is no Pre-label step.
3. **`just suspects` is a tool of the start page.** It finds doubtful older labels. It is outside the flow.
4. **The routes of the old steps are gone.** The new routes are `/api/check/digits` and `/api/check/kinds` with their
   `confirm` and `sure` routes. `/api/undo` answers with `digits` or `kinds` for the new steps.
5. **The journal does not change.** Two new screen names, `digits` and `kinds`, join the old ones. An older journal still
   loads.

Reassessment trigger: the cells without a photo are so few that the developer wants to drop them from the flow.

## Consequences

- The old page and every route that the app does not use are gone. The Python store lost the Check and Progress code.
- A new worktree needs `pnpm install` before `just label-cells`, as for every other package.
- The approval of an imported photo writes `sudoku-photos.csv` at once, as the old Photos screen did. Undo cannot
  reverse it. An uploaded scan keeps its journal lines and its undo.
- A cell in `unlabeled/` belongs to Flow A when a scan with an accepted outline holds it, else to Flow B. Every waiting
  cell is in one flow.
- The server handles one request at a time. A fetch or `just suspects` blocks the app until it ends. The app
  shows that it waits. One request at a time also keeps the journal and the file moves in order.
- Two places describe the API. The schema tests catch a server change. A type change without a schema change needs the
  review.

## Reassessment Triggers

- The labelling app needs to run for more than one person or on another machine. Then the localhost-only rule and
  SUD-02 need a new decision.
- The API grows past about 20 routes. Then generate the types from one schema.
- `ml/` gets a second web UI. Then decide again where UI code lives.
