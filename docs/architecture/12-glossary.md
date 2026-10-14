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
| Drift | The largest net move of a grid corner over `DRIFT_WINDOW`, in points per second. Noise and tremor cancel over the window. A drift above `DRIFT_LIMIT` is a clear move, such as a pan |
| Entry | A digit the player filled in. In a scan: a `handwritten` digit. Editable |
| Start entries | The entries that come with the start of a game and that the player did not make, such as handwritten digits from a scan. A retry keeps them |
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
| Work folder | `data/work/`. It holds the journal and the derived files of the labelling tool. Outside git. A person may delete the derived files at any time. The journal holds the unfinished work (ADR-018) |
| Finish | The button of the labelling page that folds the journal into `cells.csv`, runs the data check, writes `STATUS.md` and deletes the journal and the derived files. After Finish, Undo cannot reverse the finished changes (ADR-018) |
| Data check | `just check-data`. It tests that ids and files are unique and that the images agree with `cells.csv` and `sudoku-photos.csv`. It prints a report (ADR-018) |
| Technique solver | The solver in `@sudoku/core` that will solve like a person. It will grade difficulty and give hints (ADR-011). v1 does not have it |
| Frame processor | A VisionCamera function that runs for every camera frame on a separate thread, off the JS thread |
| Given | A digit printed in the puzzle. In a scan: a `printed` digit. Locked |
| Grid-exact accuracy | The share of fixture scans with all 81 digits right. The metric that matters (10 §10.2, ADR-007) |
| Intersection | One of the 10 × 10 points where grid lines cross. Found on capture, used for per-cell flattening |
| JSI | JavaScript Interface. Lets JS call native code directly, without serialising data |
| Kind head | The classifier output that says `none`, `printed`, `handwritten` or `notes`. The kind says how the mark was made: `printed` by a printer or a screen, `handwritten` by a person (ADR-009, amendment) |
| Lock-on | The moment the same grid has been in view long enough without a clear move, and the scan captures |
| Manifest (model) | `manifest.json` next to the promoted model: version, contract, metrics, dataset |
| Manifest (dataset) | A file in git listing every image of a dataset version with hash and label. For the real cells: `data/cells.csv` (ADR-018) |
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
| Steady state | The grid corners move slower than the steady threshold. The overlay shows it. Lock-on does not read it (ADR-019) |
| Effect lab | The switch between effects in a development build: the dev pill and its list. A release build does not have it |
| Dev pill | The button at the top of the camera screen in a development build. It shows the active effect and opens the list of effects |
| Draw kit | The paints, the star sprite and the compiled runtime shaders that the engine makes once and gives to every effect |
| Lock-on progress | 0 to 1: how long the grid has been in view without a clear move, divided by `LOCK_DWELL`. It resets when the grid is lost, found again, jumps or clearly moves. At 1 the scan locks on. The gathered dots show it |
| Shutter | The button on the camera screen that captures at any time, also without lock-on |
| Scanner runtime | The worklet runtime on which `recognise()` and the classifier run, off the JS thread and the UI thread |
| Correction screen | The screen after a scan. It shows the recognised grid, marks the uncertain cells and offers Retake. The player can fix a digit and its kind there. Play this puzzle loads it when the play gate passes |
| Play gate | The check before "Play this puzzle" loads a scan. Given conflicts, no solution, several solutions and a grid that is already solved block it. Uncertain cells and wrong entries do not |
| Scanned puzzle | A puzzle loaded from a scan. Its source is scanned. Its level is the level of the nearest givens target (ADR-011) |
| Transition gate | A point on the capture transition's timeline where the clock holds until an input is ready: the photo at 0.05 s, the results at 0.70 s |
| Transition clock | The clock on the UI thread that drives the capture transition. It holds at the transition gates |
| Cross-fade path | The capture transition without movement. The layers fade in place. It runs with Reduce Motion, after a shutter press without a grid, and when the photo conversion fails |
| Install (model) | `just install-model <run>`: copies an exported run into the app without the promote gate. M0 only (ADR-007) |
| Reference outputs | `reference-outputs.json`: the PyTorch probabilities for the 81 reference cells. The phone's outputs must match them (ADR-005) |
| Domain utils file | `<domain>.utils.ts`: the plain functions and types of one domain, such as tracking or transition. No React, no UI. See `apps/mobile/AGENTS.md` |
| Folder entry | The `index.ts` of a screen, component or hook folder. It re-exports the public items of that folder and nothing else |
| Effect registry | `src/scan/effects/registry.ts`: the list of overlay effects and the default effect (ADR-014) |
| Journal | `data/work/journal.jsonl`: one line per change of the unfinished work, append-only: kinds, digits and the sources of cut cells. Undo and rollback work on it. Finish folds it into `cells.csv` and deletes it (ADR-018). It replaces the kind log of ADR-009 |
| Labelling page | The local page of `just label-cells`, on 127.0.0.1 only. Screens: Groups, Review, Check and Progress |
| Review item | A cell whose label one of the checks doubts: near-duplicates disagree, the model disagrees, or the blind check disagrees |
| Check agreement | The share of blind check answers that match the current kind. It estimates the label quality |
| Sureness | How much closer a cell is to its own group centre than to the next one. The Groups screen shows the least sure cells first |
| Unsure | The kind label for a cell that the developer cannot decide. Training ignores it |
| Theme | One typed object with every token the app needs. The app ships four: Daylight, Midnight, Op-art and Progressive (ADR-015, ADR-021) |
| Primitive token | A raw value, such as a hex colour. Only the folder of its own theme reads it (ADR-015) |
| Semantic token | A token named by its meaning, such as `colors.text` or `type.given`. Most components read these (ADR-015) |
| Component token | A token that belongs to one component, such as `components.cell.selected` (ADR-015) |
| Theme decoration | A named slot in a component that a theme can fill with drawn structure, such as a texture behind the grid. The slots are `panelEdge`, `titleMark` and `cardEdge` (ADR-015, ADR-021) |
| Type role | A semantic text style for one kind of text: the digits `type.given`, `type.entry` and `type.note`, and `display`, `question`, `status` and `eyebrow` (ADR-015, ADR-021) |
| Text pair | A text token and the background token it is drawn on. The contrast test checks every pair (ADR-015) |
| Daylight | The light theme (ADR-015) |
| Midnight | The dark theme (ADR-015) |
| Op-art | A light theme: a white page, one cobalt colour and wavy parallel lines (ADR-021) |
| Progressive | A light theme: a beige page, black only, a black disc and vertical stripes (ADR-021) |
| Theme registry | `src/theme/themes/registry.ts`: the list `THEMES` of every theme with its label. The theme type, the Settings picker, the theme preference, the Unistyles registration and the contrast test read it (ADR-021) |
| Decoration registry | `src/theme/decorations/registry.ts`: the theme decoration of each theme for each slot, outside the Unistyles theme object (ADR-021) |
| Panel edge | The `panelEdge` slot: a band on the top edge of the correction panel. Op-art draws 4 wavy cobalt lines. Progressive draws vertical stripes (ADR-021) |
| Card edge | The `cardEdge` slot: a band across the top of the finish card. Op-art draws 4 wavy white lines (ADR-021) |
| Title mark | The `titleMark` slot: a mark next to the screen title. Progressive draws a black disc (ADR-021) |
| Game | One puzzle in progress: the givens, the solution, the entries, the start entries, the notes, the mistakes, the hints used and the time played. `@sudoku/core` holds its rules |
| Selected cell | The one cell that a number key, Erase or a note acts on. The player selects it with a tap |
| Notes mode | The state of the Notes tool. When it is on, a number key toggles a note instead of placing an entry |
| Mistake | An entry that differs from the solution. Each one counts once, and undo does not remove it. The third mistake ends the game. A digit loaded from a scan is not a mistake |
| Hint | A move that fills one cell with its correct number. It counts once. ADR-011 decides which cell the hint picks |
| Complete number | A number with all nine placed correctly. Its key is disabled. Wrong placements do not count |
| Assist | A shade on the grid that helps the player see the board: row and column, box, selected cell or same numbers. Each one turns on or off in Settings |
| Puzzle number | The seed of a generated puzzle, shown on the finish card: "Puzzle 412 077". The app draws seeds below 1 000 000 (ADR-011) |
| Pulse | The short wave of colour that spreads from a cell when a correct number completes a row, column, box, number or the whole grid. A haptic tap goes with it |
| Haptic | One named vibration of the app: tick, tap, thud, soft, success, warning or error. Each name has one meaning. `src/utils/haptics.utils.ts` lists them |
| Haptics switch | The Settings switch that turns every haptic of the app on or off. It is on by default |
| Cell mark | The short effect of the last move on one cell: a shake for a mistake, a glow for a hint and a flash for an undo |
| Lost hold | The 400 ms between the third mistake and the rise of the game over sheet, so the player sees the shake and the third dot |
| Game over sheet | The sheet that rises after the third mistake. It offers to try the puzzle again, start a new puzzle or go home |
| Finish card | The card that shows a solved puzzle: level, time, a small grid, mistakes, hints, best time, source and date |
| Level | The difficulty of a puzzle: easy, medium, hard or expert. ADR-011 decides how a puzzle gets its level |
| Game status | The state of a game: playing, paused, lost or won. Only a playing game accepts moves, and only a playing game counts time |
| Undo step | The entries and notes before one move. Undo restores the last undo step. It does not restore the mistake count |
| Completion | What one move completed: rows, columns, boxes, complete numbers or the whole grid. A pulse shows it |
| Theme preference | The player's choice in Settings: System, Daylight, Midnight, Op-art or Progressive. System follows the light or dark setting of the iPhone (ADR-021) |
| Adaptive theme | The theme that follows the iPhone setting: Daylight in light mode, Midnight in dark mode |
| Peer | A cell that shares a row, column or box with another cell. A cell has 20 peers |
| Unit | One row, one column or one 3×3 box. Each unit holds the digits 1 to 9 once |
| Solution | The full grid that the givens allow. A playable puzzle has exactly one |
| Seed | An integer that names one generated puzzle. The same seed and level give the same puzzle on every device (ADR-011). The app stores it with the game (ADR-012) |
| Time played | The time a game counted while its status was playing. The app tells the core how much time passed. The core never reads a clock |
| Saved game | A game as a plain object with a version number, so the app can store it and load it again (ADR-012) |
| Game in progress | The one game that the app saves after every move, so the player can resume it. Starting a new game discards it (ADR-012) |
| History | The list of won and lost games: level, source, result, time played, mistakes, hints and date (ADR-012) |
| Best time | The shortest time played of a won generated game without hints, at one level (ADR-012) |
| Home screen | The first screen of the app. It lists the levels, offers Continue for the game in progress, and links to Scan and Settings |
| Continue | The home screen button that resumes the game in progress at its last move, with its time played |
| Route | One screen that the app can show, at one path, such as `/game`. A file in `src/app/` defines it (ADR-016) |
| Route file | A file in `src/app/` that renders one screen from a feature folder and nothing else (ADR-016) |
| Native stack | The stack of screens that uses the iOS screen stack: the push animation and the swipe back. Expo Router gives it (ADR-016) |
| Save queue | The queue in front of `PuzzleRepository.save`. One write runs at a time, and only the newest game waits |
| Pause layer | The layer over the grid while a game is paused. It says "Paused" and "Tap to resume". It hides every digit and note |
| Correction pad | The edit pad on the correction screen: a Given and Entry switch, the keys 1 to 9 and Clear |
| Correction panel | The panel below the grid on the correction screen. It has three states: the summary state, the check state and the pick state |
| Summary state | The correction panel state that shows the count of cells to check, the level, Play this puzzle and Solve |
| Check state | The correction panel state for one uncertain cell: its crop from the photo and "Is this a N?" with No and Yes |
| Pick state | The correction panel state with the keypad 1–9 and Empty. It opens after No, or after a tap on a sure cell |
| Ring threshold | The confidence below which a cell gets a dashed ring on the correction screen: `REVIEW_CONFIDENCE`, 0.8 |
| Dev menu | The sheet of the correction screen in a development build. It shows the debug views, the kind labels, the ring threshold slider and Save corrections |
| Given conflict | Two givens with the same digit in one row, column or box. The correction screen marks both |
| Assist preview | The small live grid on the settings screen. It shows the assists that are on |
| Display grid | The real game grid in read-only mode: no taps, no haptics, no pulse. The settings preview uses it, and later the finish card |
| Sudoku photo | A photo of a whole sudoku. A row of `data/sudoku-photos.csv` lists it. The labelling tool cuts cells from it (ADR-018) |
| Cell | One square of a sudoku grid, cut from a sudoku photo or from a scan. A real cell is a row of `data/cells.csv` and an image in `cells/<digit>/` (ADR-018) |
| Status (sudoku photo) | The decision on a sudoku photo: `pending`, `accepted`, `rejected`, `too-few-cells` or `legacy`. A `legacy` sudoku photo was cut before photo checks existed (ADR-018) |
| Image store | The folder with `cells/` and `sudoku-photos/`: `data/images/`, or the folder that `SUDOKU_IMAGES` names. Outside git (ADR-018) |
| Photo check | The Photos screen of the labelling page: a person accepts, corrects or rejects the grid outline of an imported sudoku photo. See ADR-018 |
| Usable cell | A cell whose 4 corners lie inside the sudoku photo after the flatten. Only usable cells are cut |
| Pre-label | The model's proposed digit and kind for an unlabelled cell, with how sure it is of each. A proposal, not a label |
| Digit pass | The Digits screen: a person confirms a screen of pre-labelled cells per digit and corrects the exceptions |
| Discarded cell | A cell that a person rejected in the digit pass. It stays in `cells/discarded/`. Training ignores it |
| Cell source | The sudoku photo, row and column (0-8) that a cut cell comes from: the columns `photo_id`, `row` and `col` of `cells.csv` (ADR-018) |
| App variant | One of two builds of the app with its own bundle ID: the development variant and the production variant. `APP_VARIANT` selects it (ADR-022) |
| Development variant | The app variant for daily work: "Sudoku Dev", bundle ID `com.vandemaelefelix.sudoku.dev`, an icon with a DEV ribbon. The default (ADR-022) |
| Production variant | The app variant for real use and release: "Sudoku", bundle ID `com.vandemaelefelix.sudoku`, the clean icon (ADR-022) |
| DEV ribbon | The cobalt band with "DEV" cut out of it on the development variant icon: across the top-right corner on iOS, a strip below the 9 on Android |
| Abandoned game | A game that a new game replaces before it ends. It has the history result `abandoned`. It is not in the win rate. See ADR-023 |
| Flawless win | A won game with zero mistakes and zero hints. See ADR-023 |
| Day streak | The number of days in a row with at least one won game, in the time zone of the player. See ADR-023 |
| Verify | The check of a full scanned grid. `verifyGrid` says solved, wrong or clash. The button says "Check the grid". "Check" in code means the per-cell check of an uncertain cell |
| Splash ground | The plain colour of the native splash and of the first frame of the splash overlay. White in light mode, near black in dark mode. It follows the system appearance, not the saved theme (ADR-024) |
| Splash overlay | The view at the top of `RootLayout` that draws the splash animation over the app. It passes every touch to the screen below (ADR-024) |
