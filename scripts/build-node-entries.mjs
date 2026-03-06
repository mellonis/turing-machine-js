import { rollup } from 'rollup';

const packages = [
  {
    name: '@turing-machine-js/machine',
    entry: 'packages/machine/dist/index.js',
    outputs: {
      esm: 'packages/machine/dist/index.mjs',
      cjs: 'packages/machine/dist/index.cjs',
    },
    external: [],
  },
  {
    name: '@turing-machine-js/builder',
    entry: 'packages/builder/dist/index.js',
    outputs: {
      esm: 'packages/builder/dist/index.mjs',
      cjs: 'packages/builder/dist/index.cjs',
    },
    external: [
      '@turing-machine-js/machine',
      '@turing-machine-js/machine/src',
    ],
  },
  {
    name: '@turing-machine-js/library-binary-numbers',
    entry: 'packages/library-binary-numbers/dist/index.js',
    outputs: {
      esm: 'packages/library-binary-numbers/dist/index.mjs',
      cjs: 'packages/library-binary-numbers/dist/index.cjs',
    },
    external: [
      '@turing-machine-js/machine',
      '@turing-machine-js/machine/src',
    ],
  },
];

for (const pkg of packages) {
  const bundle = await rollup({
    input: pkg.entry,
    external: pkg.external,
  });

  await bundle.write({
    file: pkg.outputs.esm,
    format: 'es',
    exports: 'auto',
  });

  await bundle.write({
    file: pkg.outputs.cjs,
    format: 'cjs',
    exports: 'auto',
  });

  await bundle.close();

  console.log(`Built ${pkg.name} Node entries.`);
}
