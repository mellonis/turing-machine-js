import packageJson from './package.json' with {type: 'json'};

const [organizationName, packageName] = packageJson.name.split('/');

export default {
  displayName: {
    name: packageName,
    color: 'green',
  },
  moduleNameMapper: {
    [`^${packageJson.name}$`]: '<rootDir>/src',
    // The introspection and equivalence specs dynamically import the
    // binary-number libraries for cross-package summary comparison; map them
    // to source so per-package tests resolve without requiring a prior build.
    '^@turing-machine-js/library-binary-numbers$': '<rootDir>/../library-binary-numbers/src',
    '^@turing-machine-js/library-binary-numbers-bare$': '<rootDir>/../library-binary-numbers-bare/src',
  },
  transformIgnorePatterns: [
    `node_modules/(?!${organizationName})`,
  ],
};
