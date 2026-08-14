import { execFile, spawn } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type ElevateRequest = {
  /** Absolute path to the mihomo binary. */
  binary: string
  /** Arguments passed to the kernel. */
  args: string[]
  /** Flag file: creating it tells the privileged watcher to kill the kernel. */
  stopFile: string
  /** Kernel stdout/stderr is appended here — the elevated child is not ours to pipe. */
  logFile: string
  /** Directory the generated watcher script is written to (must be user-owned). */
  scriptDir: string
  /** The kernel dies with this pid, so a crashed app never leaves a root proxy behind. */
  parentPid: number
  /** Text shown in the OS authorization prompt. */
  prompt: string
}

/**
 * Whether this process already has the privileges the kernel would need, in
 * which case a normal spawn inherits them and no prompt is warranted.
 */
export const isElevated = (): Promise<boolean> => {
  if (process.platform !== 'win32') {
    return Promise.resolve(process.getuid?.() === 0)
  }

  // `net session` needs administrator rights and fails cheaply without them.
  return new Promise((resolve) => {
    execFile('net', ['session'], (error) => resolve(!error))
  })
}

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`
const psQuote = (value: string): string => `'${value.replaceAll("'", "''")}'`

/**
 * A privileged process cannot be signalled by its unprivileged parent, so the
 * kernel is never elevated on its own: it is wrapped in a watcher that runs at
 * the same privilege level and shuts the kernel down when either the app's pid
 * disappears or the stop flag file shows up. That keeps stop/restart/quit
 * working with a single authorization prompt instead of one per action.
 */
const unixWatcherScript = (request: ElevateRequest): string =>
  [
    '#!/bin/sh',
    `${shellQuote(request.binary)} ${request.args.map(shellQuote).join(' ')} >> ${shellQuote(request.logFile)} 2>&1 &`,
    'kernel_pid=$!',
    `while kill -0 ${request.parentPid} 2>/dev/null && [ ! -f ${shellQuote(request.stopFile)} ]; do`,
    '  sleep 1',
    'done',
    'kill "$kernel_pid" 2>/dev/null',
    `rm -f ${shellQuote(request.stopFile)}`,
    '',
  ].join('\n')

const windowsWatcherScript = (request: ElevateRequest): string =>
  [
    // Kept on one line on purpose: PowerShell's line continuation is a backtick,
    // which would have to be escaped inside every template literal here.
    [
      `$kernel = Start-Process -FilePath ${psQuote(request.binary)}`,
      `-ArgumentList @(${request.args.map(psQuote).join(', ')})`,
      `-RedirectStandardOutput ${psQuote(request.logFile)}`,
      `-RedirectStandardError ${psQuote(`${request.logFile}.err`)}`,
      '-WindowStyle Hidden -PassThru',
    ].join(' '),
    `while (-not (Test-Path ${psQuote(request.stopFile)}) -and`,
    `       (Get-Process -Id ${request.parentPid} -ErrorAction SilentlyContinue)) {`,
    '  Start-Sleep -Seconds 1',
    '}',
    'Stop-Process -Id $kernel.Id -Force -ErrorAction SilentlyContinue',
    `Remove-Item ${psQuote(request.stopFile)} -Force -ErrorAction SilentlyContinue`,
    '',
  ].join('\n')

const runElevator = (command: string, args: string[]): Promise<boolean> =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true })

    child.once('error', () => resolve(false))
    // The launchers return as soon as the privileged watcher is running (macOS's
    // `do shell script` returns once the backgrounded kernel is detached), so a
    // non-zero exit is the only reliable "authorization refused" signal.
    child.once('exit', (code) => resolve(code === 0))
  })

const elevateUnix = async (scriptPath: string, prompt: string): Promise<boolean> => {
  if (process.platform === 'darwin') {
    const script = `do shell script "sh ${scriptPath.replaceAll('\\', '\\\\').replaceAll('"', '\\"')} > /dev/null 2>&1 &" with administrator privileges with prompt "${prompt.replaceAll('"', '\\"')}"`

    return runElevator('osascript', ['-e', script])
  }

  // Linux: pkexec is the only one of these with a graphical agent on a modern
  // desktop; the rest are fallbacks for systems that still ship them.
  for (const elevator of ['pkexec', 'gksudo', 'kdesudo']) {
    if (await runElevator(elevator, ['sh', scriptPath])) return true
  }

  return false
}

const elevateWindows = (scriptPath: string): Promise<boolean> =>
  runElevator('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',${psQuote(scriptPath)}) -Verb RunAs -WindowStyle Hidden`,
  ])

/**
 * Launch the kernel with administrator/root privileges. Returns false when the
 * user declines the prompt or no elevation mechanism is available — the caller
 * is expected to fall back to an unprivileged start rather than fail outright.
 */
export const spawnElevatedKernel = async (request: ElevateRequest): Promise<boolean> => {
  // A stale flag from a previous session would make the watcher exit at once.
  rmSync(request.stopFile, { force: true })

  const isWindows = process.platform === 'win32'
  const scriptPath = join(request.scriptDir, isWindows ? 'run-kernel.ps1' : 'run-kernel.sh')
  const script = isWindows ? windowsWatcherScript(request) : unixWatcherScript(request)

  // The script runs as root, so it must not be writable by anyone else.
  writeFileSync(scriptPath, script, { encoding: 'utf8', mode: 0o700 })

  return isWindows ? elevateWindows(scriptPath) : elevateUnix(scriptPath, request.prompt)
}

/** Ask the privileged watcher to shut the kernel down. */
export const requestElevatedStop = (stopFile: string): void => {
  if (existsSync(stopFile)) return
  writeFileSync(stopFile, '', 'utf8')
}
