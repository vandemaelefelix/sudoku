# Research: the quality scenarios, measured on the iPhone

Date: 2026-10-22. This record holds the measurements of the smoothness, privacy and everyday-game scenarios of
[chapter 10](../architecture/10-quality-requirements.md): QR-05 to QR-08 and QR-10 to QR-12. The steps are in the
[measurement guide](../operations/measure-quality.md). QR-01 to QR-03 are recognition targets. The promote gate
measures them (ADR-007).

Status: the method and the Mac number for QR-12 are in. The device results are open. The developer measures them in
one session on the reference iPhone.

## Device and build

| Field | Value |
| --- | --- |
| iPhone model | (open) |
| iOS version | (open) |
| Build | The development variant in Release, from `just ios-measure <UDID>` (ADR-022) |
| Commit | (open) |
| Date of the session | (open) |

## Method

The development variant writes `[measure]` lines to the iOS system log, also in its Release build. Console.app on the
Mac reads them. The production variant writes none. Nothing leaves the phone (SUD-02).

| Scenario | Target | How the value is measured |
| --- | --- | --- |
| QR-05 | Outline within 300 ms. Detection at 30 fps or more | The time from the opening of the camera screen to the first drawn outline. The frame rate of the detection results on the UI thread, each second |
| QR-06 | Each corner moves less than 2 points between frames | The largest corner step of the drawn outline in each 5 s window, phone on a stand |
| QR-07 | Lock-on to the correction screen in 1.5 s or less. Recognition in 100 ms or less | The time from the phase change at lock-on to the correction screen. The recognition is the sum of image, detect, flatten and classify |
| QR-08 | No memory growth. No thermal warning | Instruments Activity Monitor for the process memory. The JS heap from Hermes each 30 s. The thermal state in Instruments |
| QR-10 | No network request during a scan | The Instruments Network template, with "Help improve the app" off |
| QR-11 | The puzzle resumes at the last move, timer included | A kill in the app switcher, then Continue |
| QR-12 | A playable board in 2 s or less after a cold start, at each level | Instruments App Launch for the native launch, plus the logged times to the home screen and from the level tap to the board |

Limits of the method:

- The QR-05 time starts at the opening of the camera screen, so it includes the start of the camera.
- The first-outline times count on the JS thread. They include one hop from the UI thread, a few milliseconds.
- The JS heap covers only the JavaScript side. The camera, the scanner and Skia hold native memory.
- The QR-12 sum leaves out the human wait between the home screen and the tap.
- The QR-12 time from the tap restarts when the player answers the replace question, so the answer wait is not in it.
- The QR-07 lock-on time starts at the React effect of the capture phase, a few milliseconds after the lock-on frame.

## Results on the iPhone

| Scenario | Measure | Target | Result | Pass |
| --- | --- | --- | --- | --- |
| QR-05 | First outline (median, worst of 5) | ≤ 300 ms | (open) | (open) |
| QR-05 | Detection frame rate (lowest) | ≥ 30 fps | (open) | (open) |
| QR-06 | Max corner step in a 5 s window | < 2 pt | (open) | (open) |
| QR-07 | Recognition (median, worst of 5) | ≤ 100 ms | (open) | (open) |
| QR-07 | Lock-on to the correction screen (median, worst of 5) | ≤ 1.5 s | (open) | (open) |
| QR-08 | Process memory after 1 and 5 minutes | No growth | (open) | (open) |
| QR-08 | JS heap after 1 and 5 minutes | No growth | (open) | (open) |
| QR-08 | Thermal state over 5 minutes | No warning | (open) | (open) |
| QR-10 | Network connections during two scans | None | (open) | (open) |
| QR-11 | Board and clock after a kill | Last move, same time | (open) | (open) |
| QR-12 | Cold start to a board, easy | ≤ 2 s | (open) | (open) |
| QR-12 | Cold start to a board, medium | ≤ 2 s | (open) | (open) |
| QR-12 | Cold start to a board, hard | ≤ 2 s | (open) | (open) |
| QR-12 | Cold start to a board, expert | ≤ 2 s | (open) | (open) |

## First number for QR-12, on a Mac

The app generates the puzzle at the level tap. It has no puzzle pool, so the generation time is part of QR-12.
`just bench-generate` times `generate(level, seed)` for the seeds 1 to 200 of each level. The Mac is an Apple M4 Pro
with Node 24.18, at commit `c639f97`. The generator and the grading did not change after that commit on this branch.

| Level | Seeds | Mean | p95 | Slowest |
| --- | --- | --- | --- | --- |
| easy | 200 | 2.3 ms | 4.7 ms | 8.2 ms |
| medium | 200 | 2.1 ms | 3.7 ms | 4.4 ms |
| hard | 200 | 37.5 ms | 109.8 ms | 152.7 ms |
| expert | 200 | 154.3 ms | 422.3 ms | 928.6 ms |

Two other runs of the same seeds, while other jobs loaded the Mac, gave an expert p95 of 568 ms and 831 ms, and a
slowest expert seed of 1 072 ms and 2 360 ms. The seeds are the same, so the spread comes from the load. Run the bench
on an idle Mac to compare with the table.

What this shows:

- Easy and medium generate in a few milliseconds. They leave almost all of the 2 s for the launch.
- Hard and expert vary much more from seed to seed, because the generator retries until the grade fits the level.
- The slowest expert seed took 0.9 s to 2.4 s on the Mac, by the load. Hermes on the iPhone is likely slower than Node on a Mac.
  An expert cold start can therefore miss 2 s. The device result decides it.
- If expert fails on the device, a pool of generated puzzles is the fix that ADR-011 names.
