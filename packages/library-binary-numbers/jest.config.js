const packageInfo = require('./package.json');

const [organizationName, packageName] = packageInfo.name.split('/');

module.exports = {
  displayName: {
    name: packageName,
    color: 'blue',
  },
  moduleNameMapper: {
    [`^${packageInfo.name}`]: '<rootDir>/src',
  },
  transformIgnorePatterns: [
    `node_modules/(?!${organizationName})`,
  ],
};
