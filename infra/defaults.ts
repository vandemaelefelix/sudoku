// The function defaults of ADR-027 decision 3. `??=` keeps a value that a function sets itself.
$transform(sst.aws.Function, (args) => {
  args.runtime ??= 'nodejs24.x'
  args.architecture ??= 'arm64'
  args.memory ??= '512 MB'
  args.timeout ??= '10 seconds'
  // `logging` can be an Output or `false`, so only an unset value gets the default.
  args.logging ??= { retention: '1 month' }
})

export {}
