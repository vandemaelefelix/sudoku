---
status: DRAFT
---

# 12. Glossary

| Term | Definition |
| --- | --- |
| litert-torch | Google's library to convert PyTorch models to TFLite (LiteRT), formerly ai-edge-torch. See ADR-005 |
| Cell image | The 64 × 64 image of one cell after per-cell flattening. Preprocessed into the classifier's 32 × 32 input. See the model contract |
| Contract | The model contract: input format, outputs, labels and manifest shared by `ml/` and the app |
| Walking skeleton | Milestone M0: the thinnest real path from camera to model on the iPhone. Production code that proves ADR-002 and ADR-005 |
| Digit head | The classifier output that says `empty` or 1–9 |
| Entry | A digit the player filled in. In a scan: a `handwritten` digit. Editable |
| Expo | The React Native framework and tooling used for the app. Development builds, since native modules are needed |
| fast-opencv | `react-native-fast-opencv`, OpenCV functions callable from JS and frame processors over JSI |
| fast-tflite | `react-native-fast-tflite`, runs TFLite models from JS and frame processors. This project uses the CPU delegate: Metal is not supported, Core ML is opt-in |
| Fixture | A photo of a sudoku with its true grid and kinds, and the cell images the app's scanner made from it. Public set in `fixtures/scans`, private set outside git (ADR-013). Never used for training. The synthetic reference pairs in `fixtures/preprocess/` are also fixtures |
| Fixture runner | A screen in development builds that runs the real scanner on fixture photos (ADR-010) |
| Holdout | The fixture split that is not looked at while training, only scored at promote (ADR-007) |
| Near-duplicate group | Cells with almost the same image, found by a difference hash. The split keeps a group in one set, so near-twins do not leak between training and validation |
| Reference pair | A synthetic cell image in `fixtures/preprocess/` with its expected 32 × 32 model input. Python and the app both test against it |
| Temperature | A number that divides the digit logits before the softmax. Fitted on the validation set so that the confidence matches the accuracy |
| Expected calibration error (ECE) | The average gap between the confidence of the model and its accuracy, in bins of confidence. Lower is better |
| Op table | `tflite_2_17_ops.json`: the highest version of each TFLite operator that the 2.17 runtime supports. Export checks the model against it (ADR-005) |
| Contact sheet | An image of 50 numbered cells with their label and predicted label. A person uses it to check labels (`just suspects`) |
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
| Review rate | The share of cells that the correction screen marks as uncertain. Reports give the accuracy at a review rate, for example 99.7 % at 5 % |
| Suspect | A training cell whose label is probably wrong, found by `just suspects` |
| Quad | The four outer corners of the detected grid |
| Skia | `react-native-skia`, a 2D drawing library used for the outline and the transition |
| VisionCamera | `react-native-vision-camera`, the camera library with frame processors |
| Frame resizer | `react-native-vision-camera-resizer`. It turns a camera frame and scales it on the GPU before fast-opencv sees it. Version 5.2.3 turns a sideways frame upside down |
| One Euro filter | A smoothing filter whose cutoff rises with speed. It keeps a still outline steady and lets a moving outline follow with little lag. Used for corner smoothing |
| Outline | The four-sided line that Skia draws over the camera preview, on the smoothed quad |
| Dot field | The live overlay on the camera screen: faint dots that float, and gather on the grid intersections when a grid is found |
| Free dot | A dot of the dot field that floats. It stays out of the grid and its margin |
| Gathered dot | A dot of the dot field that sits on one grid intersection and follows it |
