module.exports = function (api) {
  const env = api.env();

  const envOptsNoTargets = {
    loose: true,
    modules: false,
  };
  const envOpts = Object.assign({}, envOptsNoTargets);

  const convertESM = true;
  const ignoreLib = true;
  const nodeVersion = '6.9';

  // eslint-disable-next-line default-case
  switch (env) {
    // Configs used during bundling builds.
    case 'production':
      // Config during builds before publish.
      envOpts.targets = {
        node: nodeVersion,
      };
      break;
    case 'development':
      envOpts.debug = true;
      envOpts.targets = {
        node: 'current',
      };
      break;
    case 'test':
      envOpts.targets = {
        node: 'current',
      };
      break;
  }

  const config = {
    sourceType: 'module',
    comments: false,
    ignore: [
      ignoreLib ? 'packages/*/lib' : null,
    ].filter(Boolean),
    presets: [['@babel/env', envOpts]],
    plugins: [
      convertESM ? ['@babel/transform-modules-commonjs', { lazy: true }] : null,
    ].filter(Boolean),
    overrides: [
      {
        // The vast majority of our src files are modules, but we use
        // unambiguous to keep things simple until we get around to renaming
        // the modules to be more easily distinguished from CommonJS
        test: [
          'packages/*/src',
          'packages/*/test',
        ],
        sourceType: 'unambiguous',
      },
    ].filter(Boolean),
  };

  return config;
};
