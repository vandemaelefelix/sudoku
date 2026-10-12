---
status: DRAFT
---

# ADR-017: The finish card tilts with Reanimated's motion sensor

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-12 |
| Contact | Felix      |

## Context

The finish card (#43) tilts a little when the phone moves, and a shine moves over it. The
game-screen concept asks for an ADR before the card is built. The card needs the attitude of
the phone (pitch and roll) on the UI thread, many times a second. The app works offline
(SUD-01) and has no analytics. With Reduce Motion on, the card must not tilt.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| `useAnimatedSensor` of Reanimated 4 | Reanimated is in the app already. The values arrive on the UI thread as a shared value, so the tilt needs no JS render. No new native code | The API can change with a major Reanimated release |
| `DeviceMotion` of `expo-sensors` | An Expo package with docs per SDK | A new native dependency and a new development build. The values arrive on the JS thread, so each reading renders or needs a bridge to a shared value |
| A tilt that follows a finger | No sensor | Not the design: the card must react to the phone |
| No tilt | Nothing to build | Fails the criterion of #43 |

## Decision

The finish card reads `useAnimatedSensor(SensorType.ROTATION, { interval: 'auto' })`.

- The first real reading is the rest position. The card tilts by the change from it.
- A change of 0.35 rad tilts the card fully: 8° on X and 10° on Y, as on the design canvas.
- With Reduce Motion on, the card does not use the sensor at all.
- On iOS, the device attitude needs no permission and no `NSMotionUsageDescription`.

## Consequences

- No new dependency and no new build.
- The tilt math is a set of worklets in `src/game/utils/tilt.utils.ts`, with Jest tests.
- The sensor stops when the card unmounts.

## Reassessment Triggers

- A Reanimated major release removes or changes `useAnimatedSensor`.
- iOS starts to ask for a permission for the device attitude.
- Another screen needs the sensor on the JS thread.
