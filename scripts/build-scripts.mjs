// Bundles the content script and service worker into single files in dist/.
import { build } from 'esbuild';

const common = { bundle: true, target: 'chrome114', minify: false, sourcemap: false, logLevel: 'info' };

await build({ ...common, entryPoints: ['src/content/index.ts'], outfile: 'dist/content.js', format: 'iife' });
await build({ ...common, entryPoints: ['src/background/index.ts'], outfile: 'dist/background.js', format: 'iife' });
