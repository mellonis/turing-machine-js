import packageJson from './package.json' with {type: 'json'};

const [organizationName, packageName] = packageJson.name.split('/');

export default {
  displayName: {
    name: packageName,
    color: 'green',
  },
  moduleNameMapper: {
    [`^${packageJson.name}`]: '<rootDir>/src',
  },
  transformIgnorePatterns: [
    `node_modules/(?!${organizationName})`,
  ],
};