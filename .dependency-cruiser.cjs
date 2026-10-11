/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'sud-04-core-has-no-dependencies',
      comment: 'SUD-04: @sudoku/core must not depend on React Native, Expo, npm packages or Node I/O.',
      severity: 'error',
      from: { path: '^packages/sudoku-core/src', pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'] },
    },
    {
      name: 'sud-04-core-stays-in-its-package',
      comment: 'SUD-04: @sudoku/core must not reach outside its own folder with a relative import.',
      severity: 'error',
      from: { path: '^packages/sudoku-core/src' },
      to: {
        pathNot: '^packages/sudoku-core/',
        dependencyTypesNot: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'],
      },
    },
    {
      name: 'sud-03-game-does-not-use-scanner',
      comment: 'SUD-03: the game must not depend on the scanner.',
      severity: 'error',
      from: { path: '^apps/mobile/src/game/' },
      to: { path: '^apps/mobile/src/scanner/' },
    },
    {
      name: 'sud-05-scanner-has-one-entry-point',
      comment: 'SUD-05: outside the scanner, import it only through src/scanner/index.ts.',
      severity: 'error',
      from: { pathNot: '^apps/mobile/src/scanner/' },
      to: { path: '^apps/mobile/src/scanner/', pathNot: '^apps/mobile/src/scanner/index\\.ts$' },
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
      from: { path: '^apps/mobile/src/(.+)/index\\.ts$', pathNot: '^apps/mobile/src/scanner/index\\.ts$' },
      to: { pathNot: '^apps/mobile/src/$1/[^/]+$', dependencyTypesNot: ['npm', 'npm-dev', 'npm-peer', 'core'] },
    },
    {
      name: 'utils-and-constants-have-no-ui',
      comment:
        'A utils or constants file holds plain logic and values. It does not import React, React Native or UI modules.',
      severity: 'error',
      from: { path: '^apps/mobile/src/.+\\.(utils|constants)\\.ts$' },
      to: { path: ['/node_modules/(react|react-native)/', '^apps/mobile/src/.*/(components|screens|hooks)/'] },
    },
    {
      name: 'constants-import-only-constants-and-types',
      comment: 'A constants file holds values. It may build on other constants and import types, nothing else.',
      severity: 'error',
      from: { path: '^apps/mobile/src/.+\\.constants\\.ts$' },
      to: { pathNot: '\\.constants\\.ts$', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'styles-import-only-react-native',
      comment: 'A styles file holds a static StyleSheet. Styles that need the theme stay in the component.',
      severity: 'error',
      from: { path: '^apps/mobile/src/.+\\.styles\\.ts$' },
      to: { pathNot: '/node_modules/react-native/' },
    },
    {
      name: 'components-and-hooks-do-not-import-screens',
      comment: 'A screen composes components and hooks, not the other way round.',
      severity: 'error',
      from: { path: '^apps/mobile/src/.*/(components|hooks)/' },
      to: { path: '^apps/mobile/src/.*/screens/' },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      from: {},
      // The model file is git-ignored (ADR-007, amendment), so CI cannot resolve it.
      to: { couldNotResolve: true, pathNot: '\\.tflite$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    // The app aliases (@/, @assets/) are copied from apps/mobile/tsconfig.json. The Expo base config cannot be read from the root.
    tsConfig: { fileName: 'tsconfig.boundaries.json' },
    exclude: { path: '^apps/[^/]+/(dist|\\.expo)/' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
}
