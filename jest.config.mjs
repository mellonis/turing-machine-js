export default {
  projects: [
    '.',
    '<rootDir>/packages/*',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!@turing-machine-js)',
  ],
};
