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
| Classical OpenCV pipeline | Basic steps map call for call. Coverage of the library's API subset to verify. scipy has no counterpart, and pixel loops in worklets are slow | Full OpenCV plus Accelerate. scipy parts still written by hand, in a fast language | Same as B |
| Debugging | Logs inside worklets, little else | Xcode debugger and Instruments | Same as B |
| Android later | Mostly free | A Kotlin twin of the plugin | Rewrite |
| Learning value | RN + ML deployment | RN + Swift + iOS ML | Swift only, React Native knowledge unused |

C was dropped in discussion: it throws away the known stack and the Android path for a
smoothness gain that A and B already deliver.

## Decision

1. **React Native with Expo** (development builds, not Expo Go, since native modules are needed).
   Continuous Native Generation: `ios/` and `android/` are generated from `app.json` and config
   plugins, and are not committed.
2. **VisionCamera 5** for the camera, with grid detection in a **frame processor**. VisionCamera 5
   is a Nitro module: it needs `react-native-nitro-modules`, `react-native-nitro-image`,
   `react-native-vision-camera-worklets` and `react-native-worklets` (0.10, the version Expo 57
   ships). It does not use `react-native-worklets-core`. `react-native-vision-camera-resizer`
   resizes the frames.
3. **A by default.** fast-opencv (v1, OpenCV 4.9 on iOS) for classical computer vision,
   fast-tflite (v3, TFLite 2.17 on iOS) on the **CPU delegate** for inference. The Metal delegate
   of fast-tflite is not supported. The Core ML delegate is optional and not used in v1.
4. **B per step, only when a step fails in A**, by being too slow, missing an API, or needing
   maths a worklet cannot do well. That step becomes a Swift frame-processor plugin. The scanner
   interface ([05 §5.4](../05-building-block-view.md)) hides which engine runs a step.
5. **Skia + Reanimated** for the outline and the transition, in both A and B.

## Validation: the walking skeleton (M0)

Real code that stays, built as milestone M0 and run on the developer's iPhone. ADR-002 moves to
Accepted when all of these pass:

| Check | Pass |
| --- | --- |
| fast-opencv builds on iOS with Expo 57 (passed, 2026-10-10) | The build passes. Known risk: fast-opencv issue #117 (iOS build fails on React Native 0.87 or with a prebuilt React-Core). Expo 57 ships React Native 0.86.3, so only the prebuilt case can apply. Fallback: apply the unmerged fix #119 with patch-package |
| Live 4-corner detection in a fast-opencv frame processor | ≥ 30 fps sustained over 60 s, no thermal warning |
| Outline drawn in Skia from smoothed corners | Visibly steady on a still page, follows within 100 ms when moved |
| fast-opencv covers the capture stage | perspective transform, threshold, contours, morphology are available (checked in the library). `cornerSubPix` is not: the intersection search uses a TypeScript or Swift replacement |
| Photo to OpenCV | A captured photo reaches fast-opencv as an upright RGB image: `photo.toImageAsync()` → raw pixels → `Mat.createFromBuffer`. Check EXIF orientation and row stride |
| Memory | No growth over 5 minutes of scanning. The code releases every Mat with `release()`, because garbage collection in a worklet runtime can lag |
| Thread handoff | Corners reach the UI thread through a shared value without passing the JS thread. The VisionCamera major version and worklet runtime that do this are pinned here |
| Capture off the JS thread | `recognise()` runs while the transition animation stays at 60 fps |

Result, fast-opencv build (2026-10-10, [issue #2 comment](https://github.com/vandemaelefelix/sudoku/issues/2#issuecomment-6095305070)):

- Device: iPhone 17 Pro, iOS 26.6.2. Xcode 27.0 (27A266a).
- fast-opencv 1.0.1 compiles. A `Mat` round trip works on the device.
- fast-opencv issue #117 does not apply on React Native 0.86.3. The #119 fix is not needed.
- Expo 57 asks for Xcode 26.4 or later. Xcode 27.0 works.
- A free personal team needed Apple's WWDR G3 intermediate certificate.
- The empty frame processor ran at a steady 30.0 fps.

Result, scanner runtime (2026-10-11, issue #6):

- Device: iPhone 17 Pro, iOS 26, development build.
- A VisionCamera `Photo`, a nitro-image `Image` and a fast-tflite model pass into a runtime from `createWorkletRuntime` as plain arguments of `runOnRuntimeAsync`. `NitroModules.box()` also works. It is not needed.
- fast-opencv works on that runtime.
- The model call on the scanner runtime takes 29 to 51 ms. The parity check on the JS thread takes 20 to 24 ms (median).
- A development build loads the model twice: once for the parity check, once for the scanner.

Result, capture (2026-10-11, issue #6):

- The photo is 4224 × 2376 (16:9) with orientation `right`. `photo.toImage()` gives an upright 2376 × 4224 image in 1 to 4 ms.
- `image.toRawPixelData()` does not give upright pixels. It gives the sensor buffer (`RGBA`, 4224 px wide, 16896 bytes per row) in 61 to 77 ms. The orientation is only a flag.
- `image.resize(w, h)` draws upright. `resize(image.width, image.height)` gives an upright 2376 × 4224 `BGRA` buffer without row padding (9504 bytes per row) in 82 to 97 ms. `recognise()` reads the full pixels this way.
- fast-opencv works on the scanner runtime for `cvtColor`, `GaussianBlur`, `adaptiveThreshold`, `findContours`, `contourArea`, `arcLength`, `approxPolyDP` and `warpPerspective`.
- `getPerspectiveTransform` does not work. In fast-opencv 1.0.1, `Point2fVector.create(points)` ignores its points and returns an empty vector (`cpp/structures/point2fVector/Point2fVectorFactory.cpp`). No other JS path fills a `Point2fVector`. Every scan failed with `src.checkVector(2, CV_32F) == 4`.
- The app computes the homography in TypeScript (`perspectiveTransform` in `src/scanner/photoGeometry.ts`). It passes the result as `Mat.create(3, 3, CV_64F, h)`. This is the capture step that needs a replacement. No Swift plugin is needed.
- The downscale for the re-detection uses nitro-image `resize()`, not OpenCV.
- Timings over 7 scans, lock-on to result view: photo 118 to 133 ms, image 158 to 208 ms, detect 1 to 4 ms, flatten 129 to 137 ms, classify 76 to 87 ms, total 512 to 539 ms.
- Classify took 424 to 453 ms before the preprocessing skipped the zero weights of the area-average matrix. The output did not change.
- The dot field stayed at 118 to 120 fps (ProMotion) during every `recognise()`.
- The re-detection found the corners near the locked quad on every scan: offsets of 0.5 to 3.4 % of the grid side (limit 4 %). The photo and the video frames have the same field of view at 16:9. The capture needs no crop mapping.
- The capture plays a light haptic and no shutter sound (developer, 2026-10-11).
- Open: memory over many scans (about 33 to 40 MB of pixels per scan). Open: whether the developer feels the haptic and hears no sound.
- Digit accuracy on real paper depends on the model, not on the capture. It is out of scope for issue #6.

A failing row decides which step moves to B, not the whole approach. The measured numbers are
added to this ADR.

## Consequences

- The library facts above come from research before M0, see the [research record](../../research/2026-10-09-cell-classifier-research.md).
- Native-module upgrades (VisionCamera, fast-opencv, Skia) can break with Expo SDK upgrades.
  Upgrade them together, on a branch. See R-01 and R-08.
- The project owns one Swift plugin at most per failing step, plus a Kotlin twin if Android ever
  ships.

## Reassessment Triggers

- fast-opencv or fast-tflite goes unmaintained. Move those steps to B.
- More than half the pipeline ends up in Swift. Re-check whether A still pays for itself.
