/* eslint-disable import/no-extraneous-dependencies */
import babel from '@rollup/plugin-babel';
import { terser as rpTerser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      plugins: [rpTerser()],
    },
    {
      file: 'dist/index.es.js',
      format: 'es',
      plugins: [rpTerser()],
    },
  ],
  plugins: [
    babel.babel(),
  ],
};
