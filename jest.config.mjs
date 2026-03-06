export default {
  projects: [
    '.',
    '<rootDir>/packages/*',
  ],
  moduleNameMapper: {
    '^@turing-machine-js/machine/src$': '<rootDir>/packages/machine/src',
    '^@turing-machine-js/builder/src$': '<rootDir>/packages/builder/src',
  },
  transformIgnorePatterns: [
    'node_modules/(?!@turing-machine-js)',
  ],
};
