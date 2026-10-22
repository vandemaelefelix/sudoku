# Scan UI

Camera screen, outline, transition and correction screen. Imports the scanner only through
`src/scanner/index.ts` (SUD-05). The folder layout follows `mobile/AGENTS.md`.

| Folder | Holds |
| --- | --- |
| `screens/` | `ScanFlow` (the scene and the actions that leave the scan), `CameraScreen`, `CorrectionScreen` |
| `components/` | `CameraPermission`, `LibraryButton`, `TransitionCanvas`, `CorrectionCell`, `CorrectionRing`, `CorrectionPad` |
| `hooks/` | `useCaptureSession` (the state from lock-on to the review), `useCorrectionSession` (the state of the correction screen), `useFrameTracking`, `useImageImport` (the photo picker), `useCorrectionEdits`, `useScannedStart` |
| `utils/` | `tracking`, `lockOn` (the lock-on tracker), `preview`, `transition`, `captureResult`, `photoImage`, `photoFile` (the saved photo and the picked image), `correction`, `correctionEdit`, `correctionSession`, `finalGrid` and `play` helpers |
| `constants/` | The tuning values of those helpers |
| `effects/` | The overlay effects, their engine and the effect lab |
