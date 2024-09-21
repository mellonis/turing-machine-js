import tsEslint from 'typescript-eslint';

export default [...tsEslint.config(
  ...tsEslint.configs.recommended
), {
  ignores: ['.git', 'packages/*/dist', 'packages/*/babel.config.js'],
}];
