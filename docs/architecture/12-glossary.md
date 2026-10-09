---
status: DRAFT
---

# 12. Glossary

| Term | Definition |
| --- | --- |
| ai-edge-torch | Google's library to convert PyTorch models to TFLite (LiteRT). See ADR-005 |
| Cell image | The 64 × 64 image of one cell after per-cell flattening. Preprocessed into the classifier's 32 × 32 input. See the model contract |
| Contract | The model contract: input format, outputs, labels and manifest shared by `ml/` and the app |
| Device spike | Throwaway code on a real iPhone that proves ADR-002 and ADR-005 before they are accepted |
| Digit head | The classifier output that says `empty` or 1–9 |
| Entry | A digit the player filled in. In a scan: a `handwritten` digit. Editable |
| Expo | The React Native framework and tooling used for the app. Development builds, since native modules are needed |
| fast-opencv | `react-native-fast-opencv`, OpenCV functions callable from JS and frame processors over JSI |
| fast-tflite | `react-native-fast-tflite`, runs TFLite models from JS and frame processors, with GPU / Core ML acceleration |
| Fixture | A photo of a sudoku with its true grid and kinds, and the cell images the app's scanner made from it. Public set in `fixtures/scans`, private set outside git (ADR-013). Never used for training |
| Fixture runner | A screen in development builds that runs the real scanner on fixture photos (ADR-010) |
| Holdout | The fixture split that is not looked at while training, only scored at promote (ADR-007) |
| Technique solver | The solver in `@sudoku/core` that solves like a person. It grades difficulty and gives hints (ADR-011) |
| Frame processor | A VisionCamera function that runs for every camera frame on a separate thread, off the JS thread |
| Given | A digit printed in the puzzle. In a scan: a `printed` digit. Locked |
| Grid-exact accuracy | The share of fixture scans with all 81 digits right. The metric that matters (10 §10.2, ADR-007) |
| Intersection | One of the 10 × 10 points where grid lines cross. Found on capture, used for per-cell flattening |
| JSI | JavaScript Interface. Lets JS call native code directly, without serialising data |
| Kind head | The classifier output that says `none`, `printed`, `handwritten` or `notes` |
| Lock-on | The moment the live outline has been steady long enough, and the scan captures |
| Manifest (model) | `manifest.json` next to the promoted model: version, contract, metrics, dataset |
| Manifest (dataset) | A file in git listing every image of a dataset version with hash and label |
| Notes | Small pencil marks in a cell. Recognised as a kind, loaded as an empty cell |
| Per-cell flattening | Flattening each cell from its own four intersections, which corrects curved pages piece by piece |
| Promote | `just promote-model`: the only way a trained model reaches the app (ADR-007) |
| Quad | The four outer corners of the detected grid |
| Skia | `react-native-skia`, a 2D drawing library used for the outline and the transition |
| VisionCamera | `react-native-vision-camera`, the camera library with frame processors |
