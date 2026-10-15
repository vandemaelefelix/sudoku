---
status: DRAFT
---

# 2. Architecture Constraints

This chapter lists the constraints the project accepts from outside. Constraints the solution
creates for itself are recorded as ADRs and indexed in [00-DECISIONS.md](00-DECISIONS.md).

## 2.1 Technical Constraints

| ID | Constraint | Background |
| --- | --- | --- |
| TC-1 | iOS first, on iPhone | The developer and daily player uses an iPhone. Android stays possible (F-13) but is never tested in v1. |
| TC-2 | React Native is the known UI technology | The developer already knows React Native. A native-only stack was considered and dropped, see [ADR-002](adr/adr-002-react-native-and-scanner-engine.md). |
| TC-3 | The game needs no backend | The game and the scanner run on the phone and never need the backend (SUD-01). The backend (part 3) adds accounts and the history sync only. Superseded in part by [ADR-027](adr/adr-027-backend-platform.md) on 2026-10-15. |
| TC-4 | Training runs on an Apple Silicon Mac | No cloud GPU budget. Models MUST be small enough to train locally in minutes to hours. |
| TC-5 | The camera is the only input for scanning | No photo import from the library in v1. The live outline (F-04) needs a live camera feed. |

## 2.2 Organizational Constraints

| ID | Constraint | Background |
| --- | --- | --- |
| OC-1 | One developer, side-project time | Every moving part must earn its place. Prefer one well-known tool over two specialised ones. |
| OC-2 | Learning is a goal in itself | When two options are otherwise close, prefer the one that teaches the more relevant skill, and say so in the ADR. |
| OC-3 | No ads, no tracking, no monetisation | The project exists partly to replace an ad-heavy app (F-16). |

## 2.3 Conventions

| ID | Convention | Background |
| --- | --- | --- |
| CV-1 | Arc42 documentation in `docs/architecture/` | Same layout as the November Five architecture practice: numbered chapters, `00-DECISIONS.md` index, `adr/`, `00-concepts/`. |
| CV-2 | Conventional Commits | Readable history, and a later option to generate versions and changelogs. |
| CV-3 | Every decision that constrains later work gets an ADR | Status `Proposed` until validated, then `Accepted`. Superseding is explicit. |
| CV-4 | Diagrams in Mermaid | Renders on GitHub and in Obsidian, diffs as text. |
| CV-5 | Simplified Technical English, light | All prose follows the ten writing rules in [`AGENTS.md`](../../AGENTS.md), based on ASD-STE100. The glossary is the dictionary. |
| CV-6 | Agent instructions are tool-neutral | Shared instructions for coding agents live in `AGENTS.md`. Tool-specific files, such as `CLAUDE.md`, only import it. |
