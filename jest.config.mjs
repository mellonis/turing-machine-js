export default {
  projects: [
    '.',
    '<rootDir>/packages/*',
  ],
  moduleNameMapper: {
    '^@turing-machine-js/machine$': '<rootDir>/packages/machine/src',
    '^@turing-machine-js/builder$': '<rootDir>/packages/builder/src',
    '^@turing-machine-js/library-binary-numbers$': '<rootDir>/packages/library-binary-numbers/src',
    '^@turing-machine-js/library-binary-numbers-bare$': '<rootDir>/packages/library-binary-numbers-bare/src',
  },
  transformIgnorePatterns: [
    'node_modules/(?!@turing-machine-js)',
  ],
};
