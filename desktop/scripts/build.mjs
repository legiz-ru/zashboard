#!/usr/bin/env node
// Bundle the Electron main + preload sources into out/.
//
// Both are emitted as CommonJS (.cjs) because this package is "type": "module"
// and Electron loads the main entry through Node's ESM/CJS resolution: a plain
// .js file here would be parsed as ESM, where __dirname does not exist.
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIHOMO_VERSION } from './mihomo-asset.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: true,
  // Provided by the Electron runtime, never bundled.
  external: ['electron'],
  define: {
    'process.env.ZASHBOARD_MIHOMO_VERSION': JSON.stringify(MIHOMO_VERSION),
  },
  logLevel: 'info',
}

await build({
  ...common,
  entryPoints: [join(root, 'src', 'main', 'index.ts')],
  outfile: join(root, 'out', 'main', 'index.cjs'),
})

await build({
  ...common,
  entryPoints: [join(root, 'src', 'preload', 'index.ts')],
  outfile: join(root, 'out', 'preload', 'index.cjs'),
})

// The privileged helper is run by an OS service as `<electron> out/helper/index.cjs`
// with ELECTRON_RUN_AS_NODE=1, so it must stay outside app.asar (asarUnpack) and
// must not import electron.
await build({
  ...common,
  entryPoints: [join(root, 'src', 'helper', 'index.ts')],
  outfile: join(root, 'out', 'helper', 'index.cjs'),
})
