---
status: DRAFT
---

# Measure the quality scenarios on the iPhone

This guide measures QR-05 to QR-08 and QR-10 to QR-12 of
[chapter 10](../architecture/10-quality-requirements.md) in one session on the reference iPhone. Write each result
into the [quality measurements record](../research/2026-10-22-quality-measurements.md).

## What the app logs

Only the development variant logs, also in its Release build (ADR-022). The production variant logs nothing.
Each line starts with `[measure]` and the scenario ID, for example `[measure] QR-07 lock-on to the correction screen 1180 ms`.
The log stays on the phone and the Mac (SUD-02).

| Scenario | Lines |
| --- | --- |
| QR-05 | `first grid found … ms`, `first outline … ms` (from the opening of the camera screen), `detection … fps` (each second) |
| QR-06 | `max corner step … pt over … frames (5.0 s)` (each 5 s window) |
| QR-07 | `recognition … ms: image, detect, flatten, classify`, `lock-on to the correction screen … ms` |
| QR-08 | `scanning … min: JS heap … MB, allocated … MB, … collections` (each 30 s while the camera scans) |
| QR-12 | `home shown … ms after the bundle loaded`, `<level> generated in … ms`, `<level> board shown … ms after the tap` |

A debug build also writes `[camera]` and `[outline]` lines with the same numbers. Filter on `[measure]`.

## A scan that does not lock on

The scan locks on by itself about 2 s after the grid shows: after the warm-up of 1 s and a steady dwell of 1 s. QR-05,
QR-06 and QR-08 need the camera to run longer. Lock-on needs a grid of at least 0.35 of the view width. A smaller grid
still gets an outline, but the scan never locks on.

1. Hold the phone higher over the page, so that the grid fills less than a third of the view width.
2. Check that the outline shows. If it does not, move a little closer.

The steps below call this the far hold.

## Before the session

1. Connect the iPhone to the Mac with a cable.
2. Install the model if the worktree has none: `just install-model <run>`.
3. Build the development variant in Release: `just ios-measure <UDID>`. The app is "Sudoku Dev". It needs no Metro.
4. Open the scan screen once. Grant the camera permission. A permission prompt would add to the QR-05 time.
5. Turn off "Help improve the app" in Settings > Scanning. With it on, a scan uploads its photo (ADR-030), and QR-10 fails.
6. Open Console.app on the Mac. Select the iPhone in the sidebar.
7. Turn on Action > Include Info Messages. React Native writes `console.log` as an info message.
8. Type `[measure]` in the search field.
9. Write the iPhone model, the iOS version and the commit of the build into the record.

## QR-05: the first outline and the frame rate

1. Lay a newspaper sudoku flat under good light.
2. Hold the iPhone over it, with the grid in the middle of the view.
3. Open the scan screen from the home screen. Do not move the phone.
4. Read `first grid found` and `first outline`. Target: the outline within 300 ms.
5. Close the scan screen. Do steps 2 to 5 five times. Write the median and the worst value.
6. Open the scan screen in the far hold. Hold it for 10 s.
7. Read the `detection … fps` lines. Target: 30 fps or more.

The time starts when the camera screen opens. It includes the start of the camera.

## QR-06: a still outline

1. Rest the iPhone on a stand or a stack of books, in the far hold over the page.
2. Open the scan screen. Wait for the outline.
3. Do not touch the phone for 10 s.
4. Read the `QR-06` lines. Target: the max corner step stays under 2 points in each 5 s window.

The step is the largest move of a corner between two frames in the window. A lock-on ends the window before 5 s.

## QR-07: lock-on to the correction screen

1. Hold the phone close over the page until the scan locks on.
2. Wait for the correction screen.
3. Read the `recognition` line. Target: 100 ms or less for the sum.
4. Read the `lock-on to the correction screen` line. Target: 1.5 s or less. It includes the photo and the animation.
5. Do this five times, on two different pages.

A shutter press logs the same line. Measure with the automatic lock-on.

## QR-08: memory and heat over 5 minutes

1. Open the scan screen in the far hold.
2. In Xcode, choose Debug > Attach to Process > Sudoku Dev. Open the Debug navigator.
3. Watch the Memory gauge for 5 minutes. Target: no growth after the first minute.
4. Read the `QR-08` lines. Target: the JS heap does not grow from line to line.
5. Watch the `detection … fps` lines. A falling frame rate is a sign of heat.
6. Check the thermal state. Use the Thermal State track in Instruments, if your Xcode has it. Else read the Energy gauge in the Debug navigator.
7. Target: no thermal warning.

The JS heap covers only the JavaScript side. The camera, the scanner and Skia hold native memory. For a second check, record
the Allocations template in Instruments.

## QR-10: no network during a scan

1. Open Instruments. Choose the Network template. Select the Sudoku Dev process.
2. Start the recording.
3. Scan two sudokus to the correction screen.
4. Stop the recording. Target: no connection from the app during the scans.

The history sync sends requests when the player is signed in, for example after the app starts. Sign out of the
account in Settings first. The share switch of step 5 of the setup is the other source.

## QR-12: cold start to a playable board

1. Swipe the app away in the app switcher.
2. Open Instruments. Choose the App Launch template. Select Sudoku Dev.
3. Start the recording. Instruments opens the app itself. Do not tap the app icon.
4. Tap New game, then a level, as soon as the home screen shows. If the app asks to replace a game, tap New game.
5. Stop the recording. Read the launch time to the first frame in Instruments.
6. Read `home shown`, `<level> generated in` and `<level> board shown … (first board)` in Console.app.
7. Add the launch time, `home shown` and the time from the tap to the board. The human wait before the tap is not in this sum.
8. Do this three times for each level. Target: 2 s or less for each level.

The time from the tap leaves out the wait for the replace question. The generation runs at the tap, with no pool. On a Mac, `just bench-generate` gives the generation time of 200 seeds per level.

## QR-11: resume after a kill

1. Start a medium game. Place three numbers. Wait 20 s.
2. Note the time on the clock and the last number.
3. Swipe the app away in the app switcher.
4. Open the app. Tap Continue.
5. Target: the board has the three numbers. The clock shows the noted time, within one second.
