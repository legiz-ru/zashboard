// Privileged helper daemon.
//
// Runs as root/SYSTEM under the OS service manager and does exactly one thing:
// supervise a mihomo process on behalf of the unprivileged app, so TUN mode has
// the privileges it needs without the GUI itself running elevated.
//
// The command surface is deliberately tiny and fully enumerated — this process
// is root, so anything it accepts is an attack surface. It never takes a binary
// path or arguments from the client: those come from the install-time config
// file, which only root can write.
import { spawn, type ChildProcess } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Socket } from 'node:net'
import { dirname } from 'node:path'

type HelperConfig = {
  /** Socket / named pipe the app connects to. */
  socketPath: string
  /** File holding the shared secret; readable by root only. */
  secretPath: string
  /** mihomo executable the helper is allowed to run. */
  binaryPath: string
  /** mihomo working directory (`-d`). */
  homeDir: string
  /** Config file (`-f`) — written by the app, read by the kernel. */
  configPath: string
}

export type HelperRequest = {
  id: number
  secret: string
  command: 'ping' | 'start' | 'stop' | 'status'
}
export type HelperResponse = {
  id: number
  ok: boolean
  running?: boolean
  pid?: number
  error?: string
}

const configPath = process.argv[2]

if (!configPath) {
  console.error('usage: helper <config.json>')
  process.exit(2)
}

const config = JSON.parse(readFileSync(configPath, 'utf8')) as HelperConfig
const secret = readFileSync(config.secretPath, 'utf8').trim()

let child: ChildProcess | undefined

const isRunning = (): boolean => child !== undefined && child.exitCode === null

const start = (): HelperResponse['pid'] => {
  if (isRunning()) return child?.pid

  const spawned = spawn(config.binaryPath, ['-d', config.homeDir, '-f', config.configPath], {
    stdio: ['ignore', 'ignore', 'ignore'],
    windowsHide: true,
  })

  child = spawned
  spawned.once('exit', () => {
    if (child === spawned) child = undefined
  })

  return spawned.pid
}

const stop = (): void => {
  if (!isRunning() || !child) return
  child.kill('SIGTERM')
  // The kernel gets a moment to tear the TUN device down cleanly before the
  // hard kill; leaving a device behind breaks the machine's networking.
  const doomed = child
  const timer = setTimeout(() => doomed.kill('SIGKILL'), 5_000)

  timer.unref?.()
  child = undefined
}

const handle = (request: HelperRequest): HelperResponse => {
  // Constant work regardless of correctness — the secret check is the only
  // thing standing between an arbitrary local process and a root supervisor.
  if (request.secret !== secret) return { id: request.id, ok: false, error: 'unauthorized' }

  switch (request.command) {
    case 'ping':
      return { id: request.id, ok: true }
    case 'start':
      return { id: request.id, ok: true, running: true, pid: start() }
    case 'stop':
      stop()

      return { id: request.id, ok: true, running: false }
    case 'status':
      return { id: request.id, ok: true, running: isRunning(), pid: child?.pid }
    default:
      return { id: request.id, ok: false, error: 'unknown command' }
  }
}

const onConnection = (socket: Socket): void => {
  let buffer = ''

  socket.setEncoding('utf8')
  socket.on('data', (chunk: string) => {
    buffer += chunk

    // Newline-delimited JSON: one request per line, one response per request.
    let index = buffer.indexOf('\n')

    while (index !== -1) {
      const line = buffer.slice(0, index)

      buffer = buffer.slice(index + 1)
      index = buffer.indexOf('\n')

      if (!line.trim()) continue

      let response: HelperResponse

      try {
        response = handle(JSON.parse(line) as HelperRequest)
      } catch {
        response = { id: 0, ok: false, error: 'malformed request' }
      }

      socket.write(`${JSON.stringify(response)}\n`)
    }
  })
  socket.on('error', () => socket.destroy())
}

const server = createServer(onConnection)

if (process.platform !== 'win32') {
  // A stale socket from an unclean shutdown would make listen() fail.
  rmSync(config.socketPath, { force: true })
  mkdirSync(dirname(config.socketPath), { recursive: true })
}

server.listen(config.socketPath, () => {
  if (process.platform !== 'win32' && existsSync(config.socketPath)) {
    // Root owns the socket; 0660 plus the shared secret keeps other local users
    // out while letting the installing user's group reach it.
    chmodSync(config.socketPath, 0o660)
  }
})

const shutdown = () => {
  stop()
  server.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
