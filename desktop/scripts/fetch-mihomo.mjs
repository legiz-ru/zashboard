#!/usr/bin/env node
// Stage the arch-correct mihomo kernel (and, on Windows, wintun.dll) into
// desktop/resources/, where electron-builder's extraResources picks it up.
//
//   node scripts/fetch-mihomo.mjs [--os win32|darwin|linux] [--arch x64|arm64] [--force]
//
// Defaults to the host os/arch. The staged binary's filename is arch-agnostic
// (`mihomo` / `mihomo.exe`), so a sidecar marker records what is actually
// staged: a multi-arch electron-builder run would otherwise ship the
// first-staged arch inside every installer.
import { execFile } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { MIHOMO_VERSION, mihomoAsset } from './mihomo-asset.mjs'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const resourcesDir = join(here, '..', 'resources')

const WINTUN_VERSION = '0.14.1'
const WINTUN_ARCH = { x64: 'amd64', arm64: 'arm64' }

const flag = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)

  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const os = flag('os', process.platform)
const arch = flag('arch', process.arch)
const force = process.argv.includes('--force')

const download = async (url) => {
  const response = await fetch(url, { redirect: 'follow' })

  if (!response.ok) throw new Error(`download failed ${response.status} for ${url}`)

  return Buffer.from(await response.arrayBuffer())
}

/**
 * Pull one member out of a .zip without a dependency: bsdtar ships as `tar` on
 * every modern Windows/macOS/Linux runner and reads zip archives; `unzip` is
 * the fallback for older Linux images.
 */
const extractZipEntry = async (buffer, entry) => {
  const dir = mkdtempSync(join(tmpdir(), 'zashboard-unzip-'))
  const archive = join(dir, 'archive.zip')

  try {
    writeFileSync(archive, buffer)

    try {
      await run('tar', ['-xf', archive, '-C', dir, entry])
    } catch {
      await run('unzip', ['-o', archive, entry, '-d', dir])
    }

    return readFileSync(join(dir, entry))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const stageKernel = async () => {
  const asset = mihomoAsset(os, arch)
  const binPath = join(resourcesDir, asset.binName)
  const buffer = await download(asset.url)
  const binary =
    asset.ext === 'gz'
      ? // The .gz asset is a raw single-file binary, never a tarball.
        gunzipSync(buffer)
      : await extractZipEntry(buffer, asset.zipEntry)

  writeFileSync(binPath, binary)
  if (os !== 'win32' && os !== 'windows') chmodSync(binPath, 0o755)

  return binPath
}

/**
 * mihomo's Windows TUN backend loads wintun.dll from next to the kernel.
 *
 * This is not optional: electron-builder's Windows extraResources names the
 * file explicitly, so a missing dll fails the pack anyway — better to fail here
 * with a message that says what actually went wrong, and after a retry, since
 * the download comes from a third-party host.
 */
const stageWintun = async () => {
  const cpu = WINTUN_ARCH[arch]

  if (!cpu) throw new Error(`no wintun build for ${arch}`)

  const url = `https://www.wintun.net/builds/wintun-${WINTUN_VERSION}.zip`

  for (let attempt = 1; ; attempt++) {
    try {
      const dll = await extractZipEntry(await download(url), `wintun/bin/${cpu}/wintun.dll`)

      writeFileSync(join(resourcesDir, 'wintun.dll'), dll)
      console.log('[fetch-mihomo] staged: wintun.dll')

      return
    } catch (error) {
      if (attempt >= 3) {
        throw new Error(`could not stage wintun.dll from ${url}: ${error.message}`)
      }

      console.warn(`[fetch-mihomo] wintun.dll attempt ${attempt} failed: ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000))
    }
  }
}

const main = async () => {
  mkdirSync(resourcesDir, { recursive: true })

  const asset = mihomoAsset(os, arch)
  const marker = join(resourcesDir, '.mihomo-target')
  const want = `${os}-${arch}-${MIHOMO_VERSION}`
  const staged = existsSync(join(resourcesDir, asset.binName))
  const markerMatches = existsSync(marker) && readFileSync(marker, 'utf8').trim() === want

  if (!force && staged && markerMatches) {
    console.log(`[fetch-mihomo] already staged for ${want} (pass --force to re-download)`)
    return
  }

  console.log(`[fetch-mihomo] ${asset.name} -> ${resourcesDir}`)

  const binPath = await stageKernel()

  console.log(`[fetch-mihomo] staged: ${binPath}`)

  if (os === 'win32' || os === 'windows') await stageWintun()

  // Stamped last: a crash mid-download must not leave a marker that lets the
  // next run skip an incomplete staging.
  writeFileSync(marker, want)
}

await main()
