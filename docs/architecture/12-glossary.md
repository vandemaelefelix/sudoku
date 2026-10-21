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
| Fixture | A photo of a sudoku with its true grid and kinds, and the cell images the app's scanner made from it. Public set in `shared/fixtures/scans`, private set outside git (ADR-013). Never used for training. The synthetic reference pairs in `shared/fixtures/preprocess/` are also fixtures |
| Fixture runner | A screen in development builds that runs the real scanner on fixture photos (ADR-010) |
| Holdout | The fixture split that is not looked at while training, only scored at promote (ADR-007) |
| Near-duplicate group | Cells with almost the same image, found by a difference hash. The split keeps a group in one set, so near-twins do not leak between training and validation |
| Test split | The cells that the model never trains on. `split_cells` in `ml/src/sudoku_ml/dataset.py` computes it. Training and the Check screen both call it, so they use the same cells. It leaves out the cells with the label source `app-unedited` and keeps the cells of one scan photo together |
| Reference pair | A synthetic cell image in `shared/fixtures/preprocess/` with its expected 32 × 32 model input. Python and the app both test against it |
| Temperature | A number that divides the digit logits before the softmax. Fitted on the validation set so that the confidence matches the accuracy |
| Expected calibration error (ECE) | The average gap between the confidence of the model and its accuracy, in bins of confidence. Lower is better |
| Op table | `tflite_2_17_ops.json`: the highest version of each TFLite operator that the 2.17 runtime supports. Export checks the model against it (ADR-005) |
| Contact sheet | An image of numbered cells with their labels. Replaced by the Review screen of the labelling page |
| Work folder | `ml/dataset/work/`. It holds the journal and the derived files of the labelling tool. Outside git. A person may delete the derived files at any time. The journal holds the unfinished work (ADR-018) |
| Finish | The button of the labelling page that folds the journal into `cells.csv`, runs the data check, writes `STATUS.md` and deletes the journal and the derived files. After Finish, Undo cannot reverse the finished changes (ADR-018) |
| Data check | `just check-data`. It tests that ids and files are unique and that the images agree with `cells.csv` and `sudoku-photos.csv`. It prints a report (ADR-018) |
| Technique solver | The solver in `shared/core/src/technique/` that finds the next step like a person. It knows the tier 1 techniques and the tier 2 techniques: quads, fish, single-digit patterns and wings. It also knows colouring, the unique rectangle and chains. The grading uses it, and the hint will (ADR-011, ADR-032) |
| Frame processor | A VisionCamera function that runs for every camera frame on a separate thread, off the JS thread |
| Given | A digit printed in the puzzle. In a scan: a `printed` digit. Locked |
| Grid-exact accuracy | The share of fixture scans with all 81 digits right. The metric that matters (10 §10.2, ADR-007) |
| Intersection | One of the 10 × 10 points where grid lines cross. Found on capture, used for per-cell flattening |
| JSI | JavaScript Interface. Lets JS call native code directly, without serialising data |
| Kind head | The classifier output that says `none`, `printed`, `handwritten` or `notes`. The kind says how the mark was made: `printed` by a printer or a screen, `handwritten` by a person (ADR-009, amendment) |
| Lock-on | The moment the same grid has been in view long enough without a clear move, and the scan captures |
| Lock-on tracker | The module that owns the lock-on rule: the drift window, the dwell, the warm-up and the minimum grid size. It runs on the UI thread, one step per frame, and fires once. `src/scan/utils/lockOn.utils.ts` (ADR-019) |
| Lock latch | The JS-thread latch that lets the first of the shutter and the automatic lock-on start the scan. It refuses the second. It lives in the lock-on tracker module. The capture session uses it |
| Manifest (model) | `manifest.json` next to the promoted model: version, contract, metrics, dataset |
| Manifest (dataset) | A file in git listing every image of a dataset version with hash and label. For the real cells: `ml/dataset/cells.csv` (ADR-018) |
| Dataset tables | `ml/src/sudoku_ml/tables.py`. It is the only module that opens `cells.csv` and `sudoku-photos.csv`. It owns the typed rows, the validated readers and writers, the pixel id and the atomic write (ADR-018) |
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
| Lock-on progress | 0 to 1: how long the grid has been in view without a clear move, divided by `LOCK_DWELL`. It resets when the grid is lost, found again, jumps or clearly moves. At 1 the scan locks on. The gathered dots show it. The lock-on tracker gives it to the scene, and the effects read it there |
| Shutter | The button on the camera screen that captures at any time, also without lock-on |
| Scanner runtime | The worklet runtime on which `recognise()` and the classifier run, off the JS thread and the UI thread |
| Correction screen | The screen after a scan. It shows the recognised grid, marks the uncertain cells and offers Retake. The player can fix a digit and its kind there. Play this puzzle loads it when the play gate passes |
| Correction session | The module that owns the state of the correction screen: the edits, the given conflicts, the play gate, the verdict, the celebration, the panel state and the haptic cues. The screen renders its view and sends the intents of the player. `useCorrectionSession` |
| Final grid | The 81 cells of a scan as the player left them: digit, kind and two flags for what the player changed. One definition: `finalGrid` in `src/scan/utils/finalGrid.utils.ts`. The development scan log and the scan upload (ADR-030) both read it |
| Play gate | The check before "Play this puzzle" loads a scan. Given conflicts, no solution, several solutions and a grid that is already solved block it. Uncertain cells and wrong entries do not |
| Scanned puzzle | A puzzle loaded from a scan. Its source is scanned. Its level is the level of its grade, and `beyond` counts as expert (ADR-011) |
| Transition gate | A point on the capture transition's timeline where the clock holds until an input is ready: the photo at 0.05 s, the results at 0.70 s |
| Transition clock | The clock on the UI thread that drives the capture transition. It holds at the transition gates |
| Capture session | The module that owns the state from lock-on to the review: the capture attempt, the transition gates, the transition clock, the plan, the phase and the photo image. It disposes the photo image. The flattened grid image has no dispose call: it goes with the result. The screens and canvases of the scan read it. `useCaptureSession` |
| Capture result | The scanner result plus what the scan UI adds to an ok result: the flattened grid as a Skia image and the photo file. `src/scan/utils/captureResult.utils.ts` |
| Cross-fade path | The capture transition without movement. The layers fade in place. It runs with Reduce Motion, after a shutter press without a grid, and when the photo conversion fails |
| Install (model) | `just install-model <run>`: copies an exported run into the app without the promote gate. M0 only (ADR-007) |
| Reference outputs | `reference-outputs.json`: the PyTorch probabilities for the 81 reference cells. The phone's outputs must match them (ADR-005) |
| Domain utils file | `<domain>.utils.ts`: the plain functions and types of one domain, such as tracking or transition. No React, no UI. See `mobile/AGENTS.md` |
| Folder entry | The `index.ts` of a screen, component or hook folder. It re-exports the public items of that folder and nothing else |
| Effect registry | `src/scan/effects/registry.ts`: the list of overlay effects and the default effect (ADR-014) |
| Journal | `ml/dataset/work/journal.jsonl`: one line per change of the unfinished work, append-only: kinds, digits and the sources of cut cells. Undo and rollback work on it. Finish folds it into `cells.csv` and deletes it (ADR-018). It replaces the kind log of ADR-009 |
| Labelling page | The local page of `just label-cells`, on 127.0.0.1 only. Screens: Groups, Review, Check and Progress |
| Review item | A cell whose label one of the checks doubts: near-duplicates disagree, the model disagrees, or the blind check disagrees |
| Check agreement | The share of blind check answers that match the current kind. It estimates the label quality |
| Sureness | How much closer a cell is to its own group centre than to the next one. The Groups screen shows the least sure cells first |
| Unsure | The kind label for a cell that the developer cannot decide. Training ignores it |
| Theme | One typed object with every token the app needs. The app ships six: three colourways in two appearances (ADR-015, ADR-025, ADR-026) |
| Primitive token | A raw value, such as a hex colour. Only the folder of its own theme reads it (ADR-015) |
| Semantic token | A token named by its meaning, such as `colors.text` or `type.given`. Most components read these (ADR-015) |
| Component token | A token that belongs to one component, such as `components.cell.selected` (ADR-015) |
| Theme decoration | A named slot in a component that a theme can fill with drawn structure, such as a texture behind the grid. The slots are `panelEdge`, `cardEdge`, `summaryEdge` and `sectionRule` (ADR-015, ADR-021, ADR-026) |
| Type role | A semantic text style for one kind of text: the digits `type.given`, `type.entry` and `type.note`, and `display`, `question`, `status` and `eyebrow` (ADR-015, ADR-021) |
| Text pair | A text token and the background token it is drawn on. The contrast test checks every pair (ADR-015) |
| Op-art | The one style of the app: one ink colour and wavy parallel lines, on a white page or on the accent (ADR-021, ADR-025, ADR-026) |
| Colourway | One colour version of the Op-art style: Cobalt, Forest or Bordeaux. A colourway is a palette. One builder makes its theme (ADR-025) |
| Appearance | The setting that picks the look of a colourway: Auto, Light or Colour. Auto is a preference. A theme has only Light or Colour (ADR-026) |
| Light | The appearance with a white page and coloured content. The default (ADR-026) |
| Colour | The appearance where the accent is the page and the content is white or light. Also called full colour (ADR-026) |
| Conflict hatch | The white diagonal stripes of a conflict cell in the Colour look. `ConflictHatch` draws it. Also called the hatch (ADR-026) |
| Toggle | The boxy on and off control with a square thumb. It replaces the native switch (ADR-026) |
| Section rule | The `sectionRule` slot: a short wavy line under a section heading of Settings (ADR-026) |
| Look | One colourway in one resolved appearance, Light or Colour. The app has six looks. `Theme.appearance` holds the appearance of a look (ADR-026) |
| Accent | The main colour of a colourway, such as `#1f3fd1` for Cobalt. The palette derives from it. In the Colour look the accent is the page (ADR-025, ADR-026) |
| Segmented control | `SegmentedControl`: a row of square grid cells with one selected cell that slides. The Theme picker, the Appearance picker and the stats tabs use it (ADR-026) |
| Theme transition | The effect over a theme switch. `ThemeTransitionProvider` takes a picture of the old screen and switches the theme under it. A cell wave then reveals the new look. It takes 700 ms. Not with Reduce Motion (ADR-025, ADR-026) |
| Cell wave | The wave of splash cells that rises over the picture of the old screen in a theme transition. `ThemeCellWave` draws it. Each cell erases the picture where it passes (ADR-025) |
| Auto | The appearance preference that follows the iPhone setting: a light iPhone gives Light, a dark iPhone gives Colour (ADR-026) |
| Cobalt | The blue colourway and the default theme (ADR-025) |
| Forest | The dark green colourway (ADR-025) |
| Bordeaux | The wine red colourway. A conflict is orange and the check ring is amber (ADR-025) |
| Theme registry | `src/theme/themes/registry.ts`: the list `THEMES` of every Light theme with its label, and the list `COLOUR_THEMES` of every Colour theme (ADR-026). The theme type, the Settings picker, the theme preference, the Unistyles registration and the contrast test read it (ADR-021) |
| Decoration registry | `src/theme/decorations/registry.ts`: the theme decoration of each theme for each slot, outside the Unistyles theme object (ADR-021) |
| Panel edge | The `panelEdge` slot: a band on the top edge of the correction panel. The theme draws 4 wavy lines in its accent colour (ADR-021, ADR-025) |
| Card edge | The `cardEdge` slot: a band across the top of the finish card. Op-art draws 4 wavy white lines (ADR-021) |
| Game | One puzzle in progress: the givens, the solution, the entries, the start entries, the notes, the mistakes, the hints used and the time played. `@sudoku/core` holds its rules |
| Selected cell | The one cell that a number key, Erase or a note acts on. The player selects it with a tap |
| Notes mode | The state of the Notes tool. When it is on, a number key toggles a note instead of placing an entry |
| Mistake | An entry that differs from the solution. Each one counts once, and undo does not remove it. The third mistake ends the game. A digit loaded from a scan is not a mistake |
| Hint | A coach for one step. It shows where to look, names the technique, explains it and then shows the answer. It counts once, when it shows the answer (ADR-032) |
| Technique | A named way to solve a step, such as hidden single or X-wing. The technique solver knows it (ADR-032) |
| Fish | A technique on one digit. Some base lines (rows or columns) hold the digit in the same number of cover lines only. The digit then leaves the cover lines outside the base lines. Two lines make an X-wing, three a swordfish and four a jellyfish |
| Wing | A technique with two pincer cells that link through a pivot cell or a strong link. One of the pincers must hold a shared digit. The digit leaves the cells that see both pincers. For the XYZ-wing, the cells must also see the pivot. The XY-wing, XYZ-wing and W-wing are wings |
| Pivot | The cell of an XY-wing or XYZ-wing that sees both pincers. It holds two digits (XY-wing) or three digits (XYZ-wing) |
| Pincer | One of the two cells of a wing that hold the shared digit between them. A pincer has two digits |
| Base line | A row or column of a fish. The fish digit has two cells or more in it, and no more than the size of the fish |
| Cover line | A column of a fish with base rows, or a row of a fish with base columns. The fish digit leaves the cells of a cover line outside the base lines |
| Strong link | Two cells of a unit that are the only cells for a digit in that unit. Exactly one of them holds the digit. Skyscraper, two-string kite, W-wing, colouring and the X-chain use it |
| Weak link | Two cells of a unit that both hold the digit as a candidate. At most one of them holds the digit in the solution. The X-chain uses it between two strong links |
| Chain | A technique on a line of links. The digit leaves the cells that see both ends. The solver limits a chain to 12 cells and tries the shortest first. The X-chain uses one digit and alternates strong and weak links, from a strong link to a strong link. The XY-chain joins cells with two digits, and each next cell shares a digit with the cell before it. The last cell holds the digit that the step removes, if the first cell does not. |
| Colouring | A technique on one digit. The strong links of the digit join cells into a group. Two colours split the group, and exactly one colour holds the digit. If two cells of one colour see each other (colour wrap), the digit leaves that colour. If a cell sees both colours (colour trap), the digit leaves that cell |
| Unique rectangle | A technique for a puzzle with exactly one solution. Four cells lie in two rows, two columns and two boxes. Three of them hold the same two digits only. The fourth cell loses both digits, or the puzzle would have two solutions. The solver runs it only when the caller says that the puzzle has one solution (`unique: true`) |
| Hint plan | The steps that one hint shows, from the board to a placed digit. It has at most 6 steps |
| Rung | One level of detail in a step: look, technique, why or answer |
| Hint card | The card that replaces the keypad while the player reads a hint. It shows one rung |
| Hint strip | The reminder between the grid and the tools while the player tries the step alone |
| Focus unit | The row, column or box that a hint tells the player to look at |
| Pattern cell | A cell that forms the pattern of a technique, such as a cell of a pair |
| Support digit | A digit that the pattern uses to prove the step |
| Struck candidate | A candidate that the technique removes. It shows only on a note that the player wrote |
| Target cell | The cell where the hint ends. It gets the digit |
| Complete number | A number with all nine placed correctly. Its key is disabled. Wrong placements do not count |
| Assist | A shade on the grid that helps the player see the board: row and column, box, selected cell or same numbers. Each one turns on or off in Settings |
| Puzzle number | The seed of a generated puzzle, shown on the finish card: "Puzzle 412 077". The app draws seeds below 1 000 000 (ADR-011) |
| Pulse | The short wave of colour that spreads from a cell when a correct number completes a row, column, box, number or the whole grid. A haptic tap goes with it |
| Haptic | One named vibration of the app: tick, tap, thud, soft, success, warning or error. Each name has one meaning. `src/utils/haptics.utils.ts` lists them |
| Haptics switch | The Settings switch that turns every haptic of the app on or off. It is on by default |
| Setting store | `src/settings/settingStore.ts`. One store holds one saved setting: the value in memory, the save through `SettingsRepository`, the listeners and the default. A setting gives it a key, a parser and a serializer. Assists, the haptics switch, the scanned switch, the sharing switch and the notice flag use it (ADR-012) |
| Cell mark | The short effect of the last move on one cell: a shake for a mistake, a glow for a hint and a flash for an undo |
| Lost hold | The 400 ms between the third mistake and the rise of the game over sheet, so the player sees the shake and the third dot |
| Game over sheet | The sheet that rises after the third mistake. It offers to try the puzzle again, start a new puzzle or go home |
| Finish card | The card that shows a solved puzzle: level, time, a small grid, mistakes, hints, best time, source and date |
| Level | The difficulty of a puzzle: easy, medium, hard or expert. ADR-011 decides how a puzzle gets its level. The grade of a puzzle sets it. The generator keeps only puzzles that grade as the wanted level (amendment 2026-10-21). Until #203, a scanned puzzle still gets its level from the number of givens |
| Technique level | The level of a technique: easy, medium, hard or expert. `TECHNIQUE_LEVEL` holds it. The technique level of the hardest technique that a solve uses is the level of the puzzle. Not the tier of ADR-032, which groups techniques for the hint rollout (ADR-011) |
| Tier | A group of techniques in the hint rollout of ADR-032: tier 1, tier 2 and tier 3. A tier is not a level. The place of a technique in the difficulty scale is its technique level (ADR-011, ADR-032) |
| Choice | The mean value of the first 25 moves of a solve in rounds. A round fills every cell that a single can fill, all at once. It counts one move per cell, with the number of cells of the round as value. A step that is not a single counts one move with the value 0. A low choice means that the next cell is hard to find (ADR-011) |
| Givens floor | The number of givens where the generator stops the removal. Easy 40, medium 34, hard 29, expert 25. It keeps an easy puzzle open. It does not set the level: the grade does (ADR-011) |
| Grade | The result of `grade(givens)`: the level (or `beyond`), the hardest technique, the score, the choice and the number of steps. The puzzle must have exactly one solution (ADR-011) |
| Score | The sum of the weights of the steps of a grade, in Sudoku Explainer points. It orders puzzles inside a level. The level does not use it (ADR-011) |
| Game status | The state of a game: playing, paused, lost or won. Only a playing game accepts moves, and only a playing game counts time |
| Undo step | The entries and notes before one move. Undo restores the last undo step. It does not restore the mistake count |
| Completion | What one move completed: rows, columns, boxes, complete numbers or the whole grid. A pulse shows it |
| Theme preference | The player's choice in Settings: Cobalt, Forest or Bordeaux. A saved value of an older version gives Cobalt (ADR-025). The appearance is a second preference (ADR-026) |
| Peer | A cell that shares a row, column or box with another cell. A cell has 20 peers |
| Unit | One row, one column or one 3×3 box. Each unit holds the digits 1 to 9 once |
| Solution | The full grid that the givens allow. A playable puzzle has exactly one |
| Seed | An integer that names one generated puzzle. The same seed and level give the same puzzle on every device (ADR-011). The seed gives one random stream, and the generator tries full grids from it until one grades as the level. The app stores it with the game (ADR-012) |
| Time played | The time a game counted while its status was playing. The app tells the core how much time passed. The core never reads a clock |
| Saved game | A game as a plain object with a version number, so the app can store it and load it again (ADR-012) |
| Game in progress | The one game that the app saves after every move, so the player can resume it. Starting a new game discards it (ADR-012) |
| History | The list of won, lost and abandoned games: level, source, result, time played, mistakes, hints and date (ADR-012) |
| Best time | The shortest time played of a won generated game without hints, at one level (ADR-012) |
| Counted game | A won generated game without hints. Only a counted game gives the best time and the average time. `countsForBestTime` in `@sudoku/core` is the one rule, and the SQL repeats it (ADR-023) |
| Clock format | Minutes and seconds of a time played, for example `04:12`. It rounds down to whole seconds, like the timer. `formatClock` in `@sudoku/core` writes it for the timer, the finish card and the stats screen (ADR-023) |
| Home screen | The first screen of the app. It lists the levels, offers Continue for the game in progress, and links to Scan and Settings |
| Continue | The home screen button that resumes the game in progress at its last move, with its time played |
| Route | One screen that the app can show, at one path, such as `/game`. A file in `src/app/` defines it (ADR-016) |
| Route file | A file in `src/app/` that renders one screen from a feature folder and nothing else (ADR-016) |
| Native stack | The stack of screens that uses the iOS screen stack: the push animation and the swipe back. Expo Router gives it (ADR-016) |
| Game session | One game in progress, as plain TypeScript without React: `createGameSession` in `mobile/src/game/utils/gameSession.utils.ts`. It owns the session reducer, the clock, the pause when the app leaves the foreground and the save snapshot. `useGameSession` reads it and gives it the one `AppState` listener |
| Puzzle start | The one way to start a game, as plain TypeScript without React: `createPuzzleStart` in `mobile/src/game/utils/puzzleStart.utils.ts`. It owns the busy guard, the Replace question, the seed, the level of a scanned grid, the start in the right order and the retry. The home, scan and game screens call it through `usePuzzleStart` and keep only their navigation |
| Retry | Try this puzzle again on the game over sheet. It starts the same puzzle from its first state as a new game in progress, with a new id and the same seed. The lost game stays one history entry |
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
| Sudoku photo | A photo of a whole sudoku. A row of `ml/dataset/sudoku-photos.csv` lists it. The labelling tool cuts cells from it (ADR-018) |
| Cell | One square of a sudoku grid, cut from a sudoku photo or from a scan. A real cell is a row of `ml/dataset/cells.csv` and an image in `cells/<digit>/` (ADR-018) |
| Status (sudoku photo) | The decision on a sudoku photo: `pending`, `accepted`, `rejected`, `too-few-cells` or `legacy`. A `legacy` sudoku photo was cut before photo checks existed (ADR-018) |
| Image store | The folder with `cells/` and `sudoku-photos/`: `ml/dataset/images/`, or the folder that `SUDOKU_IMAGES` names. Outside git (ADR-018) |
| Photo check | The Photos screen of the labelling page: a person accepts, corrects or rejects the grid outline of an imported sudoku photo. See ADR-018 |
| Usable cell | A cell whose 4 corners lie inside the sudoku photo after the flatten. Only usable cells are cut |
| Pre-label | The model's proposed digit and kind for an unlabelled cell, with how sure it is of each. A proposal, not a label |
| Digit pass | The Digits screen: a person confirms a screen of pre-labelled cells per digit and corrects the exceptions |
| Discarded cell | A cell that a person rejected in the digit pass. It stays in `cells/discarded/`. Training ignores it |
| Cell source | The sudoku photo, row and column (0-8) that a cut cell comes from: the columns `photo_id`, `row` and `col` of `cells.csv` (ADR-018) |
| App variant | One of two builds of the app with its own bundle ID: the development variant and the production variant. `APP_VARIANT` selects it (ADR-022) |
| Development variant | The app variant for daily work: "Sudoku Dev", bundle ID `com.vandemaelefelix.sudoku.dev`, an icon with a DEV ribbon. The default (ADR-022) |
| Production variant | The app variant for real use and release: "Sudoku", bundle ID `com.vandemaelefelix.sudoku`, the clean icon (ADR-022) |
| DEV ribbon | The white band with "DEV" cut out of it on the development variant icon: across the bottom-left corner on iOS, a plate over the empty top-centre cell on Android |
| Abandoned game | A game that a new game replaces before it ends. It has the history result `abandoned`. It is not in the win rate. See ADR-023 |
| Flawless win | A won game with zero mistakes and zero hints. See ADR-023 |
| Day streak | The number of days in a row with at least one won game, in the time zone of the player. See ADR-023 |
| Verify | The check of a full scanned grid. `verifyGrid` says solved, wrong or clash. The button says "Check the grid". "Check" in code means the per-cell check of an uncertain cell |
| Splash ground | The plain colour of the native splash and of the first frame of the splash overlay. It is white for every look, because the native layer cannot read the saved theme. The overlay then fades it to the page colour of the saved look (ADR-024, ADR-025, ADR-026) |
| Splash overlay | The view at the top of `RootLayout` that draws the splash animation over the app. It passes every touch to the screen below (ADR-024) |
| Account | A Clerk account of a player. Optional: a player who is signed out plays as normal and nothing uploads (ADR-027) |
| Account section | The last section of Settings. Signed out, it offers "Sign in". Signed in, it shows the email and "Sign out". A build without a publishable key does not show it |
| Account lifecycle | `createAccountLifecycle` in `src/account/accountLifecycle.ts`. It owns the delete order, the lost answer, the reaction to 410 and the owner cache. The React code only calls it (ADR-028) |
| Clerk adapter | `ClerkAdapter` in `src/account/utils/`. It gives a token and a sign-out. `@clerk/expo` is the real one. A test gives a fake (ADR-028) |
| Owner cache | `OwnerCache`: the Keychain items for the cached owner and for the pending sign-out. A test uses a memory one (ADR-028) |
| Sign-in screen | The route `sign-in` (email, password and Google) or `sign-up` (create an account). The email code is a step inside each screen, not a route |
| Email code | The 6-digit code that Clerk sends to the email. Sign-up needs it to prove the email. Sign-in needs it on a new device (client trust) |
| Publishable key | The public Clerk key (`pk_test_…` or `pk_live_…`) that names the Clerk instance. It is in `app.config.ts` for the development variant. It grants no access |
| API token | The Clerk JWT of the template `sudoku-api` that each sync request sends. It lives 60 s. Clerk keeps and renews it. `useApiToken` gives it (ADR-027) |
| User ID | Our own UUID for a player, on the server only. Every row of the player in DynamoDB uses it. An identity row maps a login to it. The phone never holds it (ADR-027) |
| Clerk user ID | The `sub` of a Clerk token, such as `user_2abc`. The app knows it at sign-in, also offline. It is the owner on the phone. The server maps it to a user ID (ADR-027, ADR-028) |
| Identity row | The DynamoDB row `IDENTITY#<provider>#<subject>` that maps one login to a user ID. A new sign-in provider adds identity rows (ADR-027) |
| Tombstone | The identity row of a deleted account: `deletedAt` and a TTL of 30 days. A sync with its `sub` gets 410 `account_deleted` and creates no new user ID (ADR-027) |
| Owner | The Clerk user ID of a history entry on the phone. Before Clerk loads, it is the cached Clerk user ID from the Keychain. Null for a game finished while signed out. The sync and the stats use only the entries of the signed-in owner (ADR-028) |
| Sync | The call `POST /v1/sync`. It pushes the waiting list and pulls the changes since the cursor (ADR-028) |
| Sync service | `SyncService` in `src/sync/`. It runs a sync on each trigger and stays silent on failure (ADR-028) |
| Sync run | One pass of the sync service: push the waiting list in batches, pull every page, save the cursor after each page (ADR-028) |
| Single-flight | The rule that one sync run goes at a time. A trigger during a run asks for one more run (ADR-028) |
| Backoff | The wait before the next sync trigger acts after a failure. It starts at 30 seconds, doubles and stops at 15 minutes (ADR-028) |
| Adopt prompt | The question "Add the games on this phone to your account?" at the first sign-in. It moves the entries without an owner to the account (ADR-028) |
| Synced line | The muted line "Synced 5 min ago" at the bottom of the stats screen, only when signed in (ADR-028) |
| Accepted | A pushed history entry is accepted when the server stored it, or already holds an equal or newer `updatedAt` for its id (ADR-028) |
| Waiting list | The history entries of the signed-in owner that the server has not accepted yet: `pushed_at` is null or differs from `updated_at`. `pushed_at` holds the accepted `updatedAt`, never a clock time (ADR-028) |
| Sync page | One answer of the server with the entries that the app pushed and the entries that it downloaded. `HistoryRepository.applySyncPage` applies it in one transaction: it marks the pushed entries, writes the downloaded entries and saves the cursor (ADR-028) |
| Cursor | An opaque value from the server that marks how far a device has pulled: the watermark and, during paging, the `LastEvaluatedKey`. A null cursor pulls everything (ADR-028) |
| Watermark | The highest `syncedAt` that a device has pulled. The server reads from 5 minutes before it (ADR-028) |
| Synced at | `syncedAt`: the server time when the server stored a history entry. Only the server clock sets it (ADR-028) |
| `bySynced` | The local index of the DynamoDB table with the sort key `syncedAt`. A pull reads it in ascending order (ADR-028) |
| Full pull | A pull with a null cursor or a null watermark. It reads every row of the player: on a new device, after another account signs in, or after a 400 `invalid_cursor` (ADR-028) |
| Daily count | The DynamoDB row `COUNT#<yyyy-mm-dd>` per player. It counts the stored history entries of the day, at most 200 (ADR-027, ADR-028) |
| History entry | One finished game in the history, with a UUID. Only its soft delete changes it after the finish (ADR-012) |
| Sync contract | The zod schemas of the sync API requests and responses in `shared/sync-contract/`. The app and the `sync-api` Lambda import it (ADR-027) |
| Schema version | `schemaVersion`: the format version of a history entry on the wire and in DynamoDB. It is `1` (ADR-028) |
| Stage | One deployed copy of the backend: `felix`, `dev` or `production` (ADR-027) |
| Spending cap | The limit of €10 a month on the AWS bill (SUD-11) |
| Kill switch | The Lambda that stops every stage when the budget alert at $9 fires. Deploys refuse a stopped stage. Only `just api-on <stage>` turns a stage on again (ADR-027) |
| Kill-switch flag | The SSM parameter `/sudoku/kill-switch/<stage>`. While it exists, every deploy of that stage refuses (ADR-027) |
| Stopped stage | A stage that the kill switch stopped: the route throttle and the concurrency of `sync-api` are 0, and the flag exists (ADR-027) |
| Account guard | The three checks that stop a deploy to any AWS account other than the personal one: the `just` recipes, `app()` and `run()` in `sst.config.ts` (ADR-027) |
| Profile `sudoku` | The AWS profile of the backend. It takes its credentials from the `aws login` session of the profile `sudoku-login` through `credential_process` (ADR-027) |
| Accepted id | The id of a history entry that the server stored, or for which it already holds an equal or newer `updatedAt`. The response of a sync lists it once, in request order (ADR-028) |
| DynamoDB Local | The AWS emulator of DynamoDB in a container. `just test-api` and CI run the `sync-api` DB tests against it. It never reaches the AWS account |
| Smoke test | `just smoke-api <stage> <user id>`: a short check of a deployed stage with real Clerk tokens. The developer runs it after a deploy |
| Account stage | The stage that creates the account-wide resources, such as the budget: `production` (ADR-027) |
| Budget alert | An AWS Budgets email at $3 forecast or at $6 actual. The kill switch adds the alert at $9 (SUD-11, ADR-027) |
| Development instance | The Clerk instance that the `felix` and `dev` stages and the development variant use. Its keys start with `pk_test_` and `sk_test_` (ADR-027) |
| Issuer | The `iss` of a Clerk token: the Frontend API URL of the Clerk instance. The JWT authorizer needs an exact match with `CLERK_ISSUER` in `backend/infra/config.ts` (ADR-027) |
| Publishable key | The public key of a Clerk instance. The app config of each variant holds it. It is not a secret (ADR-027) |
| JWT template | The Clerk template `sudoku-api`. It adds `"aud": "sudoku-api"` to a token that lives 60 seconds. The app asks for it before every request (ADR-027) |
| Production instance | The Clerk instance of the `production` stage and the production variant, on `sudoku.felixvandemaele.be`. Its keys start with `pk_live_` and `sk_live_` (ADR-027) |
| Operations runbook | `docs/operations/runbook.md`. The one entry point for the backend: where each part lives, how the parts connect and what to do when one breaks |
| Area | A top-level folder that holds one deliverable: `mobile`, `ml`, `backend` or `web` (ADR-029) |
| Shared | The folder for code and files that more than one area uses (ADR-029) |
| Contributor ID | A random ID that the app makes for the device. It names the owner of an uploaded scan. It has no link to a person, unless the player signs in (ADR-030) |
| Scan record | The data of one finished scan: the cropped photo, the corners, the model answers, the final grid and the `edited` flags. The app uploads it when the setting "Help improve the app" is on (ADR-030) |
| Label provenance | The origin of a cell label in `cells.csv`: `app-edited`, `app-unedited` or `verified`. Training uses it to filter cells (ADR-030) |
| Candidate | A digit that can still go in an empty cell. The givens and the entries decide it. The notes of the player never do |
| Candidate mask | The candidates of one cell as a 9-bit number. Bit `d - 1` is set when digit `d` is a candidate. A placed cell has the mask 0 |
| Technique | A rule that a person uses to place a digit or to remove candidates, such as a hidden single or a naked pair |
| Step | One use of a technique. It lists the placements, the eliminations, the units, the pattern cells and the support cells. A chain step also lists its links. A colouring step also lists its two colour groups |
| Pattern cell | A cell that forms the technique in a step, such as one cell of a naked pair |
| Support cell | A cell with a digit on the board that causes a step, such as the cell that blocks a digit in a hidden single |
