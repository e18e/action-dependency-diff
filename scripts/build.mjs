import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'build/main.js',
  format: 'esm',
  target: 'node24',
  platform: 'node',
  loader: {
    '.json': 'copy'
  },
  banner: {
    js: `
      import { createRequire as topLevelCreateRequire } from 'node:module';
      import { dirname as topLevelDirname } from 'path';
      const require = topLevelCreateRequire(import.meta.url);
    `.trim()
  }
});
