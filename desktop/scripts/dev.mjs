#!/usr/bin/env node
// Local desktop development: stage the kernel, bundle main + preload, bring up
// the dashboard's Vite dev server, then launch Electron pointed at it so the
// renderer keeps HMR while the real main process runs.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const repoRoot = join(root, '..')
const DEV_PORT = Number(process.env.ZASHBOARD_DEV_PORT ?? 5173)
const children = []

const runStep = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    })

    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    )
  })

const waitForPort = (port, timeoutMs = 60_000) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const attempt = () => {
      const socket = createConnection({ port, host: '127.0.0.1' })

      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() > deadline) reject(new Error(`dev server never came up on :${port}`))
        else setTimeout(attempt, 300)
      })
    }

    attempt()
  })

const shutdown = () => {
  for (const child of children) child.kill()
}

process.on('SIGINT', () => {
  shutdown()
  process.exit(0)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(0)
})

const kernelBinary = join(root, 'resources', process.platform === 'win32' ? 'mihomo.exe' : 'mihomo')

if (!existsSync(kernelBinary)) {
  await runStep(process.execPath, [join(here, 'fetch-mihomo.mjs')], { cwd: root })
}

await runStep(process.execPath, [join(here, 'build.mjs')], { cwd: root })

const vite = spawn(
  'pnpm',
  ['--filter', 'zashboard', 'dev', '--port', String(DEV_PORT), '--strictPort'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)

children.push(vite)
await waitForPort(DEV_PORT)

const electronBin = (await import('electron')).default
const electron = spawn(electronBin, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ZASHBOARD_RENDERER_URL: `http://localhost:${DEV_PORT}` },
})

children.push(electron)
electron.on('exit', (code) => {
  shutdown()
  process.exit(code ?? 0)
})
