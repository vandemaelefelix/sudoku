// The cross-feature imports that exist today, as the files that a sibling feature imports. The comment names the importer.
// Remove a line when the code moves to src/components/, src/hooks/, src/preferences/, src/utils/ or src/constants/.
const CROSS_FEATURE_ALLOWLIST = [
  // techniques/TechniqueExample and settings/AssistPreview draw the real grid.
  '^mobile/src/game/components/Grid/index\\.ts$',
  '^mobile/src/game/components/DisplayGameProvider/index\\.ts$',
  // settings/assistPreview.utils builds the preview board from a session.
  '^mobile/src/game/utils/session\\.utils\\.ts$',
  '^mobile/src/game/utils/sample\\.utils\\.ts$',
  // settings/SettingsScreen reads and shows the assists.
  '^mobile/src/game/hooks/useAssists/index\\.ts$',
  '^mobile/src/game/constants/assists\\.constants\\.ts$',
  // scan/useScannedStart and home/HomeScreen start a game. scan/useCorrectionSession reads newGame.utils.
  '^mobile/src/game/hooks/usePuzzleStart/index\\.ts$',
  '^mobile/src/game/utils/newGame\\.utils\\.ts$',
  // scan/CorrectionCell draws the conflict hatch.
  '^mobile/src/game/components/ConflictHatch/index\\.ts$',
  // home/HomeScreen and home/HomeMenu show the stats.
  '^mobile/src/stats/hooks/useIncludeScanned/index\\.ts$',
  '^mobile/src/stats/components/StatsCard/index\\.ts$',
]

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'sud-04-core-has-no-dependencies',
      comment: 'SUD-04: @sudoku/core must not depend on React Native, Expo, npm packages or Node I/O.',
      severity: 'error',
      from: { path: '^shared/core/src', pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'] },
    },
    {
      name: 'sud-04-core-stays-in-its-package',
      comment: 'SUD-04: @sudoku/core must not reach outside its own folder with a relative import.',
      severity: 'error',
      from: { path: '^shared/core/src' },
      to: {
        pathNot: '^shared/core/',
        dependencyTypesNot: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'],
      },
    },
    {
      name: 'sync-contract-needs-only-zod',
      comment:
        'ADR-028: the app and the sync Lambda both import @sudoku/sync-contract, so it may depend on zod only. No React Native, no AWS SDK, no Node I/O.',
      severity: 'error',
      from: { path: '^shared/sync-contract/src', pathNot: '\\.test\\.ts$' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'],
        pathNot: '/node_modules/zod/',
      },
    },
    {
      name: 'sync-contract-stays-in-its-package',
      comment: 'ADR-028: @sudoku/sync-contract must not reach outside its own folder with a relative import.',
      severity: 'error',
      from: { path: '^shared/sync-contract/src' },
      to: {
        pathNot: '^shared/sync-contract/',
        dependencyTypesNot: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'],
      },
    },
    {
      name: 'sud-03-game-does-not-use-scanner',
      comment: 'SUD-03: the game must not depend on the scanner.',
      severity: 'error',
      from: { path: '^mobile/src/game/' },
      to: { path: '^mobile/src/scanner/' },
    },
    {
      name: 'sud-05-scanner-has-one-entry-point',
      comment: 'SUD-05: outside the scanner, import it only through src/scanner/index.ts.',
      severity: 'error',
      from: { pathNot: '^mobile/src/scanner/' },
      to: { path: '^mobile/src/scanner/', pathNot: '^mobile/src/scanner/index\\.ts$' },
    },
    {
      name: 'adr-027-app-does-not-import-infra',
      comment:
        'ADR-027: the app and the packages never import the SST code. The API is their only link to the backend.',
      severity: 'error',
      from: { path: '^(mobile|shared)/' },
      to: { path: '^(backend/infra/|sst\\.config\\.ts$)' },
    },
    {
      name: 'adr-028-game-and-stats-do-not-use-account',
      comment: 'ADR-028: the game and the stats read the owner from storage, never from the account or the sync.',
      severity: 'error',
      from: { path: '^mobile/src/(game|stats)/' },
      to: { path: '^mobile/src/(account|sync)/' },
    },
    {
      name: 'adr-027-app-does-not-import-services',
      comment:
        'ADR-027: the app and the packages never import the Lambda code. The API is their only link to the backend.',
      severity: 'error',
      from: { path: '^(mobile|shared)/' },
      to: { path: '^backend/(api|kill-switch)/' },
    },
    {
      name: 'adr-027-services-do-not-import-the-app',
      comment: 'ADR-027: the Lambda shares only @sudoku/sync-contract with the app.',
      severity: 'error',
      from: { path: '^backend/(api|kill-switch)/' },
      to: { path: '^mobile/' },
    },
    {
      name: 'adr-027-services-do-not-import-infra',
      comment: 'ADR-027: the Lambda reads its resources through the SST Resource object, not through the SST code.',
      severity: 'error',
      from: { path: '^backend/(api|kill-switch)/' },
      to: { path: '^(backend/infra/|sst\\.config\\.ts$)' },
    },
    {
      name: 'adr-027-infra-reads-only-shared-lambda-files',
      comment:
        'ADR-027: backend/infra/storage.ts reads the table layout from tableDesign.ts, so the test table matches. backend/infra/api-on.ts and the kill-switch check share the AWS code and the flag name of backend/kill-switch/src. The SST code reads no other Lambda file.',
      severity: 'error',
      from: { path: '^(backend/infra/|sst\\.config\\.ts$)' },
      to: {
        path: '^backend/(api|kill-switch)/',
        pathNot: ['^backend/api/src/tableDesign\\.ts$', '^backend/kill-switch/src/'],
      },
    },
    {
      name: 'adr-028-storage-does-not-use-sync-or-account',
      comment:
        'ADR-028: the storage tells the sync about a change through subscribe. It never imports the sync or the account.',
      severity: 'error',
      from: { path: '^mobile/src/storage/' },
      to: { path: '^mobile/src/(account|sync)/' },
    },
    {
      name: 'adr-030-scanshare-does-not-use-scan',
      comment:
        'ADR-030: the scan upload does not import the scan UI. They share src/utils/ and src/components/. The scan UI hands over a FinalGrid (src/utils/finalGrid.utils.ts).',
      severity: 'error',
      from: { path: '^mobile/src/scanShare/' },
      to: { path: '^mobile/src/scan/' },
    },
    {
      name: 'a-feature-does-not-import-a-sibling-feature',
      comment:
        'ADR-029 (amendment): code that two features use lives in src/components/, src/hooks/, src/preferences/, src/utils/ or src/constants/. The allowlist names the imports that remain. Remove a line when the code moves.',
      severity: 'error',
      from: { path: '^mobile/src/(home|game|settings|stats|techniques|scan)/', pathNot: '\\.test\\.tsx?$' },
      to: {
        path: '^mobile/src/(home|game|settings|stats|techniques|scan)/',
        pathNot: ['^mobile/src/$1/', ...CROSS_FEATURE_ALLOWLIST],
      },
    },
    {
      name: 'shared-folders-do-not-import-a-feature',
      comment:
        'ADR-029 (amendment): src/components/, src/hooks/ and src/preferences/ serve every feature, so they import no feature folder. A test may use a feature fixture.',
      severity: 'error',
      from: { path: '^mobile/src/(components|hooks|preferences)/', pathNot: '\\.test\\.tsx?$' },
      to: { path: '^mobile/src/(home|game|settings|stats|techniques|scan|storage|splash|account|sync|scanShare)/' },
    },
    {
      name: 'no-production-import-of-a-testkit',
      comment:
        'A test kit holds fixtures and fakes that use Jest globals. Only a test or another test kit imports it, so no kit reaches the app bundle.',
      severity: 'error',
      from: { pathNot: ['\\.test\\.[jt]sx?$', '\\.testkit\\.[jt]sx?$'] },
      to: { path: '\\.testkit\\.[jt]sx?$' },
    },
    {
      name: 'no-circular',
      comment: 'A cycle can give an undefined import at start-up, and it hides which module depends on which.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'index-reexports-its-own-folder',
      comment: 'An index.ts is the entry of one folder, not a barrel that collects other folders.',
      severity: 'error',
      from: { path: '^mobile/src/(.+)/index\\.ts$', pathNot: '^mobile/src/scanner/index\\.ts$' },
      to: { pathNot: '^mobile/src/$1/[^/]+$', dependencyTypesNot: ['npm', 'npm-dev', 'npm-peer', 'core'] },
    },
    {
      name: 'utils-and-constants-have-no-ui',
      comment:
        'A utils or constants file holds plain logic and values. It does not import React, React Native or UI modules.',
      severity: 'error',
      from: { path: '^mobile/src/.+\\.(utils|constants)\\.ts$' },
      to: {
        path: [
          '/node_modules/(react|react-native)/',
          '^mobile/src/(components|hooks)/',
          '^mobile/src/.*/(components|screens|hooks)/',
        ],
      },
    },
    {
      name: 'constants-import-only-constants-and-types',
      comment: 'A constants file holds values. It may build on other constants and import types, nothing else.',
      severity: 'error',
      from: { path: '^mobile/src/.+\\.constants\\.ts$' },
      to: { pathNot: '\\.constants\\.ts$', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'styles-import-only-react-native-and-the-theme',
      comment:
        'A styles file holds StyleSheet.create from react-native-unistyles. It may read React Native and the fixed colours of src/theme/, nothing else (ADR-015).',
      severity: 'error',
      from: { path: '^mobile/src/.+\\.styles\\.ts$' },
      to: {
        pathNot: ['/node_modules/react-native/', '/node_modules/react-native-unistyles/', '^mobile/src/theme/'],
      },
    },
    {
      name: 'palette-stays-in-its-theme',
      comment: 'Only the folder of a theme reads its primitive tokens (ADR-015, points 3 and 7).',
      severity: 'error',
      from: { pathNot: '^mobile/src/theme/themes/[^/]+/[^/]+$' },
      to: { path: '^mobile/src/theme/themes/[^/]+/palette\\.ts$' },
    },
    {
      name: 'a-theme-does-not-import-another-theme',
      comment:
        'Each theme is one folder with its own tokens (ADR-015, point 11). Shared values live in src/theme/shared.tokens.ts.',
      severity: 'error',
      from: { path: '^mobile/src/theme/themes/([^/]+)/' },
      to: { path: '^mobile/src/theme/themes/', pathNot: '^mobile/src/theme/themes/$1/' },
    },
    {
      name: 'styles-read-the-theme-argument',
      comment:
        'A styles file reads the theme through StyleSheet.create(theme => ...). An imported theme object does not change on a theme switch (ADR-015).',
      severity: 'error',
      from: { path: '^mobile/src/.+\\.styles\\.ts$' },
      to: { path: '^mobile/src/theme/themes/' },
    },
    {
      name: 'components-and-hooks-do-not-import-screens',
      comment: 'A screen composes components and hooks, not the other way round.',
      severity: 'error',
      from: { path: ['^mobile/src/(components|hooks)/', '^mobile/src/.*/(components|hooks)/'] },
      to: { path: '^mobile/src/.*/screens/' },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      from: {},
      // The model file is git-ignored (ADR-007, amendment), so CI cannot resolve it.
      // aws-lambda is types only: @types/aws-lambda has no package that a resolver finds by that name.
      to: { couldNotResolve: true, pathNot: ['\\.tflite$', '^aws-lambda$'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    // The app aliases (@/, @assets/) are copied from mobile/tsconfig.json. The Expo base config cannot be read from the root.
    tsConfig: { fileName: 'tsconfig.boundaries.json' },
    exclude: { path: '^mobile/(dist|\\.expo)/' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
}
