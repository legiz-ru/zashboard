#!/usr/bin/env node
// Make sure the Electron runtime is actually on disk.
//
// pnpm only runs a dependency's install script when the workspace allows it,
// and a blocked (or network-interrupted) electron postinstall leaves the
// package present but its `dist/` missing — which surfaces much later as an
// unhelpful electron-builder failure. Re-running the installer is idempotent.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const electronDir = dirname(require.resolve('electron/package.json'))

if (existsSync(join(electronDir, 'dist'))) {
  console.log('[ensure-electron] runtime already installed')
} else {
  console.log('[ensure-electron] downloading the Electron runtime')
  // Run the installer as a child process rather than importing it: a bare
  // absolute path is not a valid ESM specifier on Windows (`D:\...` is read as
  // the `d:` protocol), and a failed download should surface as an exit code.
  execFileSync(process.execPath, [join(electronDir, 'install.js')], {
    cwd: electronDir,
    stdio: 'inherit',
  })
}
