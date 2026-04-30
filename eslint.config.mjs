import tsEslint from 'typescript-eslint';

export default [...tsEslint.config(
  ...tsEslint.configs.recommended
), {
  ignores: ['.git', 'coverage', 'packages/*/dist', 'packages/*/babel.config.js'],
}];
