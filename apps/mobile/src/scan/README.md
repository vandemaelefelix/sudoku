# Scan UI

Camera screen, outline, transition and correction screen. Imports the scanner only through
`src/scanner/index.ts` (SUD-05). The folder layout follows `apps/mobile/AGENTS.md`.

| Folder | Holds |
| --- | --- |
| `screens/` | `ScanFlow` (live or review), `CameraScreen`, `CorrectionScreen` |
| `components/` | `CameraPermission`, `TransitionCanvas`, `CorrectionCell`, `CorrectionRing` |
| `hooks/` | `useCapture`, `useFrameTracking`, `useCaptureTransition`, `useTransitionClock` |
| `utils/` | `tracking`, `preview`, `transition` and `correction` helpers |
| `constants/` | The tuning values of those helpers |
| `effects/` | The overlay effects, their engine and the effect lab |
