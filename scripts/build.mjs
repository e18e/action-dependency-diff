import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'main.js',
  format: 'esm',
  target: 'node24',
  platform: 'node',
  banner: {
    js: `
      import { fileURLToPath } from 'node:url';
      import { createRequire as topLevelCreateRequire } from 'node:module';
      import { dirname as topLevelDirname } from 'path';
      const require = topLevelCreateRequire(import.meta.url);
    `.trim()
  }
});
