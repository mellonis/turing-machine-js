import packageJson from './package.json' with {type: 'json'};

const [organizationName, packageName] = packageJson.name.split('/');

export default {
  displayName: {
    name: packageName,
    color: 'magenta',
  },
  moduleNameMapper: {
    [`^${packageJson.name}$`]: '<rootDir>/src',
    '^@turing-machine-js/machine$': '<rootDir>/../machine/src',
  },
  transformIgnorePatterns: [
    `node_modules/(?!${organizationName})`,
  ],
};
