---
status: DRAFT
---

# ADR-002: React Native (Expo) with a VisionCamera scanner, community libraries first and Swift per step

| Field   | Value                                    |
| ------- | ---------------------------------------- |
| Project | Sudoku                                   |
| Status  | Proposed, pending the walking skeleton (M0) |
| Date    | 2026-10-09                               |
| Contact | Felix                                    |

## Context

The app needs a smooth live outline of the sudoku grid (F-04), an animated transition to the
flattened grid (F-10) and digit recognition (F-05). The developer knows React Native (TC-2). The
open question was whether React Native can make the camera part smooth, or whether that needs
native code.

The scan has one hot path: grid detection on every frame. Everything else runs once per capture
and is too short to feel. Smoothness therefore depends on keeping per-frame work off the
JavaScript thread, not on the UI framework.

## Alternatives Evaluated

| | A. RN + community native libraries | B. RN + own Swift plugin | C. Native SwiftUI |
| --- | --- | --- | --- |
| Vision engine | VisionCamera frame processors with fast-opencv and fast-tflite | VisionCamera frame-processor plugin in Swift: OpenCV's iOS framework, Apple Vision, Core ML | Swift with Apple Vision and Core ML |
| Per-frame cost | CPU OpenCV on a downscaled frame. JSI calls cost microseconds, image data stays native | Same with OpenCV. Apple Vision's rectangle detector is hardware-tuned and kinder to the battery | Same as B |
| Animation | Skia + Reanimated | Skia + Reanimated | SwiftUI / Core Animation |
| Porting the old OpenCV logic | Basic pipeline maps call for call. Coverage of the library's API subset to verify. scipy has no counterpart, and pixel loops in worklets are slow | Full OpenCV plus Accelerate. scipy parts still written by hand, in a fast language | Same as B |
| Debugging | Logs inside worklets, little else | Xcode debugger and Instruments | Same as B |
| Android later | Mostly free | A Kotlin twin of the plugin | Rewrite |
| Learning value | RN + ML deployment | RN + Swift + iOS ML | Swift only, React Native knowledge unused |

C was dropped in discussion: it throws away the known stack and the Android path for a
smoothness gain that A and B already deliver.

## Decision

1. **React Native with Expo** (development builds, not Expo Go, since native modules are needed).
   Continuous Native Generation: `ios/` and `android/` are generated from `app.json` and config
   plugins, and are not committed.
2. **VisionCamera** for the camera, with grid detection in a **frame processor**.
3. **A by default.** fast-opencv for classical computer vision, fast-tflite for inference.
4. **B per step, only when a step fails in A**, by being too slow, missing an API, or needing
   maths a worklet cannot do well. That step becomes a Swift frame-processor plugin. The scanner
   interface ([05 §5.4](../05-building-block-view.md)) hides which engine runs a step.
5. **Skia + Reanimated** for the outline and the transition, in both A and B.

## Validation: the walking skeleton (M0)

Real code that stays, built as milestone M0 and run on the developer's iPhone. ADR-002 moves to
Accepted when all of these pass:

| Check | Pass |
| --- | --- |
| Live 4-corner detection in a fast-opencv frame processor | ≥ 30 fps sustained over 60 s, no thermal warning |
| Outline drawn in Skia from smoothed corners | Visibly steady on a still page, follows within 100 ms when moved |
| fast-opencv covers the capture stage | perspective transform, threshold, contours, morphology available, or a named Swift fallback |
| Memory | No growth over 5 minutes of scanning (Mat buffers released) |
| Thread handoff | Corners reach the UI thread through a shared value without passing the JS thread. The VisionCamera major version and worklet runtime that do this are pinned here |
| Capture off the JS thread | `recognise()` runs while the transition animation stays at 60 fps |

A failing row decides which step moves to B, not the whole approach. The measured numbers are
added to this ADR.

## Consequences

- Native-module upgrades (VisionCamera, fast-opencv, Skia) can break with Expo SDK upgrades.
  Upgrade them together, on a branch. See R-01 and R-08.
- The project owns one Swift plugin at most per failing step, plus a Kotlin twin if Android ever
  ships.

## Reassessment Triggers

- fast-opencv or fast-tflite goes unmaintained. Move those steps to B.
- More than half the pipeline ends up in Swift. Re-check whether A still pays for itself.
