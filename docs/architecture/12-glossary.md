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
| Contact sheet | An image of numbered cells with their labels. Replaced by the Review screen of the labelling page |
| Technique solver | The solver in `@sudoku/core` that solves like a person. It grades difficulty and gives hints (ADR-011) |
| Frame processor | A VisionCamera function that runs for every camera frame on a separate thread, off the JS thread |
| Given | A digit printed in the puzzle. In a scan: a `printed` digit. Locked |
| Grid-exact accuracy | The share of fixture scans with all 81 digits right. The metric that matters (10 §10.2, ADR-007) |
| Intersection | One of the 10 × 10 points where grid lines cross. Found on capture, used for per-cell flattening |
| JSI | JavaScript Interface. Lets JS call native code directly, without serialising data |
| Kind head | The classifier output that says `none`, `printed`, `handwritten` or `notes`. The kind says how the mark was made: `printed` by a printer or a screen, `handwritten` by a person (ADR-009, amendment) |
| Lock-on | The moment the grid corners have been steady long enough, and the scan captures |
| Armed (lock-on) | A scene that may lock on automatically. The first scene is armed. A scene after a Retake arms only after the grid is gone for 0.5 s after the warm-up, or jumps to another place. The shutter does not need it. See the scan-pipeline concept |
| Manifest (model) | `manifest.json` next to the promoted model: version, contract, metrics, dataset |
| Manifest (dataset) | A file in git listing every image of a dataset version with hash and label |
| Notes | Small pencil marks in a cell. In a scan: a kind, loaded as an empty cell. In the game: the candidate numbers that the player sets in notes mode |
| Per-cell flattening | Flattening each cell from its own four intersections, which corrects curved pages piece by piece |
| Promote | `just promote-model`: the only way a trained model reaches the app (ADR-007). Until M3, Install is the one exception (ADR-007). |
| Review rate | The share of cells that the correction screen marks as uncertain. Reports give the accuracy at a review rate, for example 99.7 % at 5 % |
| Suspect | A training cell whose label is probably wrong, found by `just suspects` |
| Quad | The four outer corners of the detected grid |
| Skia | `react-native-skia`, a 2D drawing library used for the overlay effects and the transition |
| VisionCamera | `react-native-vision-camera`, the camera library with frame processors |
| Frame resizer | `react-native-vision-camera-resizer`. It turns a camera frame and scales it on the GPU before fast-opencv sees it. Version 5.2.3 turns a sideways frame upside down |
| One Euro filter | A smoothing filter whose cutoff rises with speed. It keeps a still outline steady and lets a moving outline follow with little lag. Used for corner smoothing |
| Outline | The smoothed quad in view points. The camera screen gives it to the effect engine |
| Dot field | The simulation of the Gathering dots effect, the default effect: faint dots that float, and gather on the grid intersections when a grid is found |
| Free dot | A dot of the dot field that floats. It stays out of the grid and its margin |
| Gathered dot | A dot of the dot field that sits on one grid intersection and follows it |
| Effect | One way to draw the live overlay on the camera screen. A module with `create`, `step` and `draw` in `src/scan/effects/` (ADR-014) |
| Scene | The facts about the grid that the engine gives to every effect in each frame: the grid, its matrices, found and lost, presence, motion and the steady state |
| Steady state | The grid corners move slower than the steady threshold. The overlay then shows its lock-on reaction |
| Effect lab | The switch between effects in a development build: the dev pill and its list. A release build does not have it |
| Dev pill | The button at the top of the camera screen in a development build. It shows the active effect and opens the list of effects |
| Draw kit | The paints, the star sprite and the compiled runtime shaders that the engine makes once and gives to every effect |
| Lock-on progress | 0 to 1: how long the grid has been steady, divided by `LOCK_DWELL`. It resets when the grid is lost, found again or jumps. At 1 the scan locks on. The gathered dots show it |
| Shutter | The button on the camera screen that captures at any time, also without lock-on |
| Scanner runtime | The worklet runtime on which `recognise()` and the classifier run, off the JS thread and the UI thread |
| Correction screen | The screen after a scan. It shows the recognised grid, marks the uncertain cells and offers Retake |
| Transition gate | A point on the capture transition's timeline where the clock holds until an input is ready: the photo at 0.05 s, the results at 0.70 s |
| Transition clock | The clock on the UI thread that drives the capture transition. It holds at the transition gates |
| Cross-fade path | The capture transition without movement. The layers fade in place. It runs with Reduce Motion, after a shutter press without a grid, and when the photo conversion fails |
| Install (model) | `just install-model <run>`: copies an exported run into the app without the promote gate. M0 only (ADR-007) |
| Reference outputs | `reference-outputs.json`: the PyTorch probabilities for the 81 reference cells. The phone's outputs must match them (ADR-005) |
| Domain utils file | `<domain>.utils.ts`: the plain functions and types of one domain, such as tracking or transition. No React, no UI. See `apps/mobile/AGENTS.md` |
| Folder entry | The `index.ts` of a screen, component or hook folder. It re-exports the public items of that folder and nothing else |
| Effect registry | `src/scan/effects/registry.ts`: the list of overlay effects and the default effect (ADR-014) |
| Kind log | `ml/datasets/kind-log.jsonl`: one line per label change, append-only. The source of truth for the kind of a real cell (ADR-009, amendment) |
| Labelling page | The local page of `just label-cells`, on 127.0.0.1 only. Screens: Groups, Review, Check and Progress |
| Review item | A cell whose label one of the checks doubts: near-duplicates disagree, the model disagrees, or the blind check disagrees |
| Check agreement | The share of blind check answers that match the label in the kind log. It estimates the label quality |
| Sureness | How much closer a cell is to its own group centre than to the next one. The Groups screen shows the least sure cells first |
| Unsure | The kind label for a cell that the developer cannot decide. Training ignores it |
| Theme | One typed object with every token the app needs. Daylight and Midnight ship first (ADR-015) |
| Primitive token | A raw value, such as a hex colour. Only the folder of its own theme reads it (ADR-015) |
| Semantic token | A token named by its meaning, such as `colors.text` or `type.given`. Most components read these (ADR-015) |
| Component token | A token that belongs to one component, such as `components.cell.selected` (ADR-015) |
| Theme decoration | A named slot in a component that a theme can fill with drawn structure, such as a texture behind the grid. None exists in v1 (ADR-015) |
| Type role | A semantic text style for one kind of digit: `type.given`, `type.entry` or `type.note` (ADR-015) |
| Text pair | A text token and the background token it is drawn on. The contrast test checks every pair (ADR-015) |
| Daylight | The light theme (ADR-015) |
| Midnight | The dark theme (ADR-015) |
| Game | One puzzle in progress: the givens, the solution, the entries, the notes, the mistakes, the hints used and the time played. `@sudoku/core` holds its rules |
| Selected cell | The one cell that a number key, Erase or a note acts on. The player selects it with a tap |
| Notes mode | The state of the Notes tool. When it is on, a number key toggles a note instead of placing an entry |
| Mistake | An entry that differs from the solution. Each one counts once, and undo does not remove it. The third mistake ends the game. A digit loaded from a scan is not a mistake |
| Hint | A move that fills one cell with its correct number. It counts once. ADR-011 decides which cell the hint picks |
| Complete number | A number with all nine placed correctly. Its key is disabled. Wrong placements do not count |
| Assist | A shade on the grid that helps the player see the board: row and column, box, selected cell or same numbers. Each one turns on or off in Settings |
| Pulse | The short wave of colour that spreads from a cell when a correct number completes a row, column, box, number or the whole grid. A haptic tap goes with it |
| Game over sheet | The sheet that rises after the third mistake. It offers to try the puzzle again, start a new puzzle or go home |
| Finish card | The card that shows a solved puzzle: level, time, a small grid, mistakes, hints, best time, source and date |
| Level | The difficulty of a puzzle: easy, medium, hard or expert. ADR-011 decides how a puzzle gets its level |
| Game status | The state of a game: playing, paused, lost or won. Only a playing game accepts moves, and only a playing game counts time |
| Undo step | The entries and notes before one move. Undo restores the last undo step. It does not restore the mistake count |
| Completion | What one move completed: rows, columns, boxes, complete numbers or the whole grid. A pulse shows it |
| Theme preference | The player's choice in Settings: System, Daylight or Midnight. System follows the light or dark setting of the iPhone |
| Adaptive theme | The theme that follows the iPhone setting: Daylight in light mode, Midnight in dark mode |

| Peer | A cell that shares a row, column or box with another cell. A cell has 20 peers |
| Unit | One row, one column or one 3×3 box. Each unit holds the digits 1 to 9 once |
| Solution | The full grid that the givens allow. A playable puzzle has exactly one |
| Time played | The time a game counted while its status was playing. The app tells the core how much time passed. The core never reads a clock |
| Saved game | A game as a plain object with a version number, so the app can store it and load it again (ADR-012) |
