# Scan UI

Camera screen, outline, transition and correction screen. Imports the scanner only through
`src/scanner/index.ts` (SUD-05). The folder layout follows `mobile/AGENTS.md`.

| Folder | Holds |
| --- | --- |
| `screens/` | `ScanFlow` (the scene and the actions that leave the scan), `CameraScreen`, `CorrectionScreen` |
| `components/` | `CameraPermission`, `LibraryButton`, `TransitionCanvas`, `CorrectionCell`, `CorrectionRing`, `CorrectionPad`, `CorrectionBar`, `CorrectionPanel`, `FailurePanel` |
| `hooks/` | `useCaptureSession` (the state from lock-on to the review), `useCorrectionSession` (the state of the correction screen), `useFrameTracking`, `useImageImport` (the photo picker), `useCorrectionEdits`, `useScannedStart`, `useTransitionClock` (the transition clock), `useCorrectionCues`, `useExitReport`, `useSaveState`, `useCorrectionBoard`, `useDigitSizes`, `useCorrectionMotion`, `useDevOverlay` |
| `utils/` | `tracking`, `lockOn` (the lock-on tracker), `preview`, `transition`, `captureResult`, `photoImage`, `photoFile` (the saved photo and the picked image), `correction`, `correctionEdit`, `correctionLabels`, `correctionSession`, `failureCopy`, `finalGrid` and `play` helpers |
| `constants/` | The tuning values of those helpers |
| `effects/` | The overlay effects, their engine and the effect lab |
