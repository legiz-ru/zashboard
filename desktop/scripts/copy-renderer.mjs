#!/usr/bin/env node
// Copy the built dashboard (repo-root `dist/`) into desktop/renderer/, which
// electron-builder ships as extraResources and the app serves over the
// zashboard:// scheme.
//
// The PWA service worker is stripped on the way in: inside a packaged app every
// asset is already local, so the worker buys nothing and its precache would
// happily keep serving the previous version's bundle after an app update.
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const dist = join(root, '..', 'dist')
const target = join(root, 'renderer')

if (!existsSync(dist)) {
  console.error(`[copy-renderer] ${dist} not found — run "pnpm --filter zashboard build" first.`)
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
cpSync(dist, target, { recursive: true })

const dropped = readdirSync(target).filter(
  (name) => name === 'sw.js' || name === 'registerSW.js' || /^workbox-.*\.js$/.test(name),
)

for (const name of dropped) {
  rmSync(join(target, name), { force: true })
}

const indexPath = join(target, 'index.html')
const html = readFileSync(indexPath, 'utf8')
const cleaned = html
  .replace(/<script[^>]*registerSW\.js[^>]*><\/script>/g, '')
  .replace(/<script[^>]*>[^<]*serviceWorker[^<]*<\/script>/g, '')

writeFileSync(indexPath, cleaned, 'utf8')

console.log(
  `[copy-renderer] staged ${target}${dropped.length ? ` (removed ${dropped.join(', ')})` : ''}`,
)
