import type { ChildProcess } from 'node:child_process'
import { execFile, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import type { KernelLogLine, KernelState } from '../shared/ipc'
import { applyRuntimeConfig } from './config'

export type KernelOptions = {
  binaryPath: string
  homeDir: string
  configPath: string
  externalController: string
  secret: string
  defaultMixedPort: number
  /** How long to wait for the REST API to answer before declaring a failure. */
  startTimeoutMs?: number
  /** Consecutive crash restarts before the supervisor gives up. */
  maxRestarts?: number
}

export type KernelEvents = {
  state: [KernelState]
  log: [KernelLogLine]
}

const RESTART_BACKOFF_MS = 1_000
/** A run this long counts as healthy and clears the crash counter. */
const STABLE_RUN_MS = 30_000

const killTree = (child: ChildProcess): void => {
  if (child.pid === undefined) return

  if (process.platform === 'win32') {
    // mihomo has no children of its own, but /T keeps a wrapper (or a future
    // helper) from surviving the parent.
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {})
    return
  }

  child.kill('SIGKILL')
}

/**
 * Supervises the bundled mihomo process: rewrites the runtime keys into the
 * active config, spawns the kernel, waits for its REST API to answer, streams
 * stdout/stderr as log lines, and restarts it (bounded, with backoff) when it
 * exits without being asked to.
 */
export class Kernel extends EventEmitter<KernelEvents> {
  private child: ChildProcess | undefined
  private intentionalStop = false
  private restartCount = 0
  private restartTimer: NodeJS.Timeout | undefined
  private stableTimer: NodeJS.Timeout | undefined
  private binaryPath: string
  private readonly startTimeoutMs: number
  private readonly maxRestarts: number
  private state: KernelState

  constructor(private readonly options: KernelOptions) {
    super()
    this.binaryPath = options.binaryPath
    this.startTimeoutMs = options.startTimeoutMs ?? 15_000
    this.maxRestarts = options.maxRestarts ?? 3
    this.state = {
      status: 'stopped',
      externalController: options.externalController,
      secret: options.secret,
      mixedPort: options.defaultMixedPort,
    }
  }

  getState(): KernelState {
    return { ...this.state }
  }

  /** The kernel's REST API base URL, as handed to the dashboard. */
  get endpoint(): { url: string; secret: string } {
    return { url: `http://${this.state.externalController}`, secret: this.state.secret }
  }

  /** Swap the kernel binary; takes effect on the next start/restart. */
  setBinaryPath(path: string): void {
    this.binaryPath = path
  }

  async start(): Promise<void> {
    if (this.child) return

    this.clearRestartTimer()
    this.intentionalStop = false
    this.setState({ status: 'starting', error: undefined })

    const mixedPort = await this.writeRuntimeConfig()

    this.setState({ mixedPort })

    const child = spawn(
      this.binaryPath,
      ['-d', this.options.homeDir, '-f', this.options.configPath],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    )

    this.child = child
    child.stdout?.on('data', (chunk: Buffer) => this.emitLines('stdout', chunk))
    child.stderr?.on('data', (chunk: Buffer) => this.emitLines('stderr', chunk))

    child.on('error', (error) => {
      this.child = undefined
      this.setState({ status: 'errored', pid: undefined, error: error.message })
    })

    child.on('exit', (code, signal) => {
      this.child = undefined
      this.clearStableTimer()

      if (this.intentionalStop) {
        this.setState({ status: 'stopped', pid: undefined })
        return
      }

      const reason = signal ? `killed by ${signal}` : `exited with code ${code}`

      this.setState({ status: 'errored', pid: undefined, error: `mihomo ${reason}` })
      this.scheduleRestart()
    })

    try {
      await this.waitForApi()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      // The process may still be alive but wedged; tear it down so the next
      // start() is not blocked by an already-bound port.
      if (this.child) {
        this.intentionalStop = true
        killTree(this.child)
      }
      this.setState({ status: 'errored', error: message })
      throw error
    }

    this.setState({ status: 'running', pid: child.pid, error: undefined })
    this.stableTimer = setTimeout(() => {
      this.restartCount = 0
    }, STABLE_RUN_MS)
    this.stableTimer.unref?.()
  }

  async stop(): Promise<void> {
    this.clearRestartTimer()
    this.clearStableTimer()

    const child = this.child

    if (!child) {
      this.setState({ status: 'stopped', pid: undefined })
      return
    }

    this.intentionalStop = true

    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(() => {
        killTree(child)
        resolve()
      }, 5_000)

      timer.unref?.()
      child.once('exit', done)
      if (process.platform === 'win32') killTree(child)
      else child.kill('SIGTERM')
    })

    this.child = undefined
    this.setState({ status: 'stopped', pid: undefined })
  }

  async restart(): Promise<void> {
    await this.stop()
    this.restartCount = 0
    await this.start()
  }

  /** Ask the running kernel for its version string; empty when unavailable. */
  async version(): Promise<string> {
    try {
      const response = await fetch(`${this.endpoint.url}/version`, {
        headers: { Authorization: `Bearer ${this.state.secret}` },
      })

      if (!response.ok) return ''

      const body = (await response.json()) as { version?: string }

      return body.version ?? ''
    } catch {
      return ''
    }
  }

  private async writeRuntimeConfig(): Promise<number> {
    const source = await readFile(this.options.configPath, 'utf8')
    const { text, mixedPort } = applyRuntimeConfig(source, {
      externalController: this.options.externalController,
      secret: this.options.secret,
      defaultMixedPort: this.options.defaultMixedPort,
    })

    await writeFile(this.options.configPath, text, 'utf8')

    return mixedPort
  }

  private async waitForApi(): Promise<void> {
    const deadline = Date.now() + this.startTimeoutMs

    while (Date.now() < deadline) {
      if (!this.child) {
        throw new Error(this.state.error ?? 'mihomo exited before its API came up')
      }

      try {
        const response = await fetch(`${this.endpoint.url}/version`, {
          headers: { Authorization: `Bearer ${this.state.secret}` },
        })

        if (response.ok) return
      } catch {
        // Not listening yet — keep polling until the deadline.
      }

      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    throw new Error(`mihomo did not answer on ${this.state.externalController} in time`)
  }

  private scheduleRestart(): void {
    if (this.restartCount >= this.maxRestarts) {
      this.setState({
        error: `${this.state.error ?? 'mihomo crashed'} — giving up after ${this.maxRestarts} restarts`,
      })
      return
    }

    this.restartCount += 1

    const delay = RESTART_BACKOFF_MS * this.restartCount

    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined
      void this.start().catch(() => {
        // start() already published the failure through state.
      })
    }, delay)
    this.restartTimer.unref?.()
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer)
    this.restartTimer = undefined
  }

  private clearStableTimer(): void {
    if (this.stableTimer) clearTimeout(this.stableTimer)
    this.stableTimer = undefined
  }

  private emitLines(stream: 'stdout' | 'stderr', chunk: Buffer): void {
    for (const line of chunk.toString('utf8').split('\n')) {
      if (line.trim().length === 0) continue
      this.emit('log', { stream, line, ts: Date.now() })
    }
  }

  private setState(patch: Partial<KernelState>): void {
    this.state = { ...this.state, ...patch }
    this.emit('state', this.getState())
  }
}
