---
status: DRAFT
---

# 1. Introduction and Goals

Sudoku is a personal project with two parts that grow into three. An iOS app to play sudoku every
day, and a machine-learning pipeline that lets the app scan a paper sudoku from a newspaper or a
puzzle book, load it, and solve it or give a hint. A backend for accounts and the history
across devices follows, and a leaderboard after it (ADR-027).

The project has two reasons to exist:

1. **Learning and portfolio.** Build the whole chain once, properly: data, training, export,
   on-device inference, a live camera pipeline and a React Native app, documented in Arc42.
2. **Replace the current sudoku app.** The app on the phone today is full of ads. This one has
   none, works offline, and is good enough to use every day.
Shipping to the App Store is possible but not a goal. Decisions SHOULD NOT block it.

## 1.1 Requirements Overview

The system has three parts. The backend starts with accounts and the history sync.

| Part | What it is | Scope |
| --- | --- | --- |
| **Game** | The sudoku app: generated puzzles, difficulty levels, notes, timer, hints | Now |
| **Scan** | Camera → live grid outline → digit recognition → correction → load into the game | Now |
| **Backend** | Accounts and the history across devices on AWS ([ADR-027](adr/adr-027-backend-platform.md), [ADR-028](adr/adr-028-history-sync.md)). A leaderboard later | Now: accounts and sync. Later: the leaderboard |

### Functional Requirements (MoSCoW)

| ID | Requirement | Priority |
| --- | --- | --- |
| F-01 | Play generated puzzles at several difficulty levels | Must |
| F-02 | Notes (pencil marks), undo, mistake highlighting and a timer while playing | Must |
| F-03 | Save and resume a puzzle in progress | Must |
| F-04 | Live outline of the sudoku grid in the camera preview, with a visible lock-on | Must |
| F-05 | Recognise every cell as empty or a digit, and as printed, handwritten or notes | Must |
| F-06 | Correction screen before loading a scan: fix a digit, toggle given / mine | Must |
| F-07 | Solve, or give a logical hint, for any puzzle, generated or scanned | Must |
| F-08 | Everything above works without a network connection | Must |
| F-09 | Statistics and history (best times, streaks, finished puzzles), stored on the device | Should |
| F-10 | Animated transition from the photo to the flattened grid, with digits filling in | Should |
| F-11 | Share a corrected scan as training data, through a disclosed setting that the player can turn off (ADR-030) | Should |
| F-12 | Correct strongly curved book pages beyond per-cell flattening | Could |
| F-13 | Android build | Could |
| F-14 | Accounts and a cloud sync of the history. A leaderboard later | Should (accounts and sync), Could (leaderboard). Part 3, the backend |
| F-15 | Read the individual pencil notes inside a notes cell | Won't (now) |
| F-16 | Ads, tracking or any monetisation | Won't |

## 1.2 Quality Goals

The full tree and scenarios are in [10-quality-requirements.md](10-quality-requirements.md).

| Priority | Quality goal | Why |
| --- | --- | --- |
| 1 | **Recognition correctness** | One wrong digit breaks the puzzle. The grid as a whole has to be right, not the average cell |
| 2 | **Smooth scanning** | The live outline and the transition are the feature people notice. Jitter or stutter makes it feel broken |
| 3 | **Offline and private** | A daily game that needs a network is worse than the app it replaces. Nothing leaves the phone unless the player exports it |
| 4 | **Understandable architecture** | It is a learning and portfolio project. A reader must be able to follow every boundary and decision |
| 5 | **Everyday game** | It replaces the app used every day: instant start, progress never lost, a hint when stuck |

## 1.3 Stakeholders

| Role | Expectation |
| --- | --- |
| Felix (developer and daily player) | A polished, ad-free game, and a project that teaches the full ML-to-mobile chain |
| Portfolio reader | A clean repository whose architecture and decisions can be read without running it |
| Possible App Store users | A trustworthy app: no ads, no tracking, works offline |
