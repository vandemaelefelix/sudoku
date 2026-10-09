---
status: DRAFT
---

# 1. Introduction and Goals

Sudoku is a personal project with two parts that grow into three. An iOS app to play sudoku every
day, and a machine-learning pipeline that lets the app scan a paper sudoku from a newspaper or a
puzzle book, load it, and solve it or give a hint. A backend for accounts, history and a
leaderboard may follow later.

The project has three reasons to exist:

1. **Learning and portfolio.** Build the whole chain once, properly: data, training, export,
   on-device inference, a live camera pipeline and a React Native app, documented in Arc42.
2. **Replace the current sudoku app.** The app on the phone today is full of ads. This one has
   none, works offline, and is good enough to use every day.
3. **Consolidate.** Four earlier sudoku repositories exist (see 1.4). When this one is complete,
   they are archived and this is the only sudoku project left.

Shipping to the App Store is possible but not a goal. Decisions SHOULD NOT block it.

## 1.1 Requirements Overview

The system has three parts. Only the first two are in scope now.

| Part | What it is | Scope |
| --- | --- | --- |
| **Game** | The sudoku app: generated puzzles, difficulty levels, notes, timer, hints | Now |
| **Scan** | Camera → live grid outline → digit recognition → correction → load into the game | Now |
| **Backend** | Accounts, history across devices, leaderboard. Possibly on AWS | Later, not designed yet |

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
| F-11 | Export a corrected scan as training data | Should |
| F-12 | Correct strongly curved book pages beyond per-cell flattening | Could |
| F-13 | Android build | Could |
| F-14 | Accounts, cloud sync, leaderboard | Won't (now). Part 3, the backend |
| F-15 | Read the individual pencil notes inside a notes cell | Won't (now) |
| F-16 | Ads, tracking or any monetisation | Won't |

## 1.2 Quality Goals

The full tree and scenarios are in [10-quality-requirements.md](10-quality-requirements.md).

| Priority | Quality goal | Why |
| --- | --- | --- |
| 1 | **Recognition correctness** | One wrong digit breaks the puzzle. The grid as a whole has to be right, not the average cell |
| 2 | **Smooth scanning** | The live outline and the transition are the feature people notice. Jitter or stutter makes it feel broken |
| 3 | **Offline and private** | A daily game that needs a network is worse than the app it replaces. Photos stay on the phone |
| 4 | **Understandable architecture** | It is a learning and portfolio project. A reader must be able to follow every boundary and decision |

## 1.3 Stakeholders

| Role | Expectation |
| --- | --- |
| Felix (developer and daily player) | A polished, ad-free game, and a project that teaches the full ML-to-mobile chain |
| Portfolio reader | A clean repository whose architecture and decisions can be read without running it |
| Possible App Store users | A trustworthy app: no ads, no tracking, works offline |

## 1.4 Predecessors

These are archived once this project covers what they did. Code is not ported. Data and lessons are.

| Repository | Period | What we keep |
| --- | --- | --- |
| [sudoku_solver](https://github.com/vandemaelefelix/sudoku_solver) (computer vision, v1) | 2020 | ~21k digit images (printed and handwritten), as a candidate data source |
| [sudoku-solver](https://github.com/vandemaelefelix/sudoku-solver) (computer vision, v2) | 2025 | The ~7.8k labelled cells (re-checked, kind label added), the lesson that whole-grid accuracy is what matters, the class-imbalance findings |
| [react-sudoku-app](https://github.com/vandemaelefelix/react-sudoku-app) (game) | 2022 | Game UX ideas: keyboard, timer, mistake highlighting, themes |
| [next-sudoku-app](https://github.com/vandemaelefelix/next-sudoku-app) (Next starter) | 2022 | Nothing |

The local folders `~/projects/sudoku_solver` and `~/projects/js-sudoku-solver` hold unpushed work
from the v2 computer-vision project. The labelled cells in `sudoku_solver/data/digits` MUST be
copied into this project's dataset before that folder is removed.
