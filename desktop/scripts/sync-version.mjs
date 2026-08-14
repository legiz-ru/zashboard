#!/usr/bin/env node
// Mirror the dashboard's version into the desktop package.
//
// release-please bumps the repo-root package.json only, and electron-builder
// takes the version (and therefore every artifact filename) from
// desktop/package.json — without this the installers would carry whatever
// version the desktop package was last committed with.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const { version } = JSON.parse(readFileSync(join(root, '..', 'package.json'), 'utf8'))
const manifestPath = join(root, 'package.json')
const manifest = readFileSync(manifestPath, 'utf8')
const updated = manifest.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`)

if (updated === manifest) {
  console.log(`[sync-version] already at ${version}`)
} else {
  writeFileSync(manifestPath, updated, 'utf8')
  console.log(`[sync-version] desktop package set to ${version}`)
}
