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
      to: { pathNot: '^packages/sudoku-core/', dependencyTypesNot: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown', 'core'] },
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
    exclude: { path: '^apps/[^/]+/(dist|\\.expo)/' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
}
