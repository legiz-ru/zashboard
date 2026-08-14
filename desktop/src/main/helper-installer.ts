import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const HELPER_SERVICE = 'zashboard-helper'

export type HelperInstallRequest = {
  /** Electron's own executable, run with ELECTRON_RUN_AS_NODE to host the helper. */
  electronPath: string
  /** Unpacked helper entry point (must be a real file, never inside the asar). */
  helperEntry: string
  socketPath: string
  secretPath: string
  configPath: string
  secret: string
  binaryPath: string
  homeDir: string
  kernelConfigPath: string
  /** Shown in the OS authorization prompt. */
  prompt: string
}

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`

/**
 * systemd unit for the helper.
 *
 * `Restart=on-failure` matters: the helper owning the kernel in TUN mode means
 * a helper crash would otherwise leave the machine with a dead TUN device and
 * no supervisor to clean it up.
 */
const systemdUnit = (request: HelperInstallRequest): string =>
  [
    '[Unit]',
    'Description=zashboard privileged helper',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    'Environment=ELECTRON_RUN_AS_NODE=1',
    `ExecStart=${request.electronPath} ${request.helperEntry} ${request.configPath}`,
    'Restart=on-failure',
    'RestartSec=2',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    '',
  ].join('\n')

const launchdPlist = (request: HelperInstallRequest): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>Label</key><string>${HELPER_SERVICE}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${request.electronPath}</string>`,
    `    <string>${request.helperEntry}</string>`,
    `    <string>${request.configPath}</string>`,
    '  </array>',
    '  <key>EnvironmentVariables</key>',
    '  <dict><key>ELECTRON_RUN_AS_NODE</key><string>1</string></dict>',
    '  <key>RunAtLoad</key><true/>',
    '  <key>KeepAlive</key><true/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n')

/**
 * Script run as root to put the helper in place: config + secret first (the
 * daemon reads both at startup), then the service definition, then start it.
 * Everything it writes is root-owned and root-only readable — the secret is
 * what authorizes commands to a root supervisor.
 */
const installScript = (request: HelperInstallRequest): string => {
  const unitPath = `/etc/systemd/system/${HELPER_SERVICE}.service`
  const plistPath = `/Library/LaunchDaemons/${HELPER_SERVICE}.plist`
  const configJson = JSON.stringify({
    socketPath: request.socketPath,
    secretPath: request.secretPath,
    binaryPath: request.binaryPath,
    homeDir: request.homeDir,
    configPath: request.kernelConfigPath,
  })

  const common = [
    '#!/bin/sh',
    'set -e',
    `mkdir -p "$(dirname ${shellQuote(request.configPath)})"`,
    `printf '%s' ${shellQuote(configJson)} > ${shellQuote(request.configPath)}`,
    `printf '%s' ${shellQuote(request.secret)} > ${shellQuote(request.secretPath)}`,
    `chmod 600 ${shellQuote(request.secretPath)}`,
    `chmod 644 ${shellQuote(request.configPath)}`,
  ]

  if (process.platform === 'darwin') {
    return [
      ...common,
      `cat > ${shellQuote(plistPath)} <<'ZASHBOARD_PLIST'`,
      launchdPlist(request),
      'ZASHBOARD_PLIST',
      `chmod 644 ${shellQuote(plistPath)}`,
      `launchctl bootout system/${HELPER_SERVICE} 2>/dev/null || true`,
      `launchctl bootstrap system ${shellQuote(plistPath)}`,
      '',
    ].join('\n')
  }

  return [
    ...common,
    `cat > ${shellQuote(unitPath)} <<'ZASHBOARD_UNIT'`,
    systemdUnit(request),
    'ZASHBOARD_UNIT',
    'systemctl daemon-reload',
    `systemctl enable --now ${HELPER_SERVICE}.service`,
    '',
  ].join('\n')
}

const uninstallScript = (request: HelperInstallRequest): string => {
  const unitPath = `/etc/systemd/system/${HELPER_SERVICE}.service`
  const plistPath = `/Library/LaunchDaemons/${HELPER_SERVICE}.plist`

  if (process.platform === 'darwin') {
    return [
      '#!/bin/sh',
      `launchctl bootout system/${HELPER_SERVICE} 2>/dev/null || true`,
      `rm -f ${shellQuote(plistPath)} ${shellQuote(request.configPath)} ${shellQuote(request.secretPath)}`,
      '',
    ].join('\n')
  }

  return [
    '#!/bin/sh',
    `systemctl disable --now ${HELPER_SERVICE}.service 2>/dev/null || true`,
    `rm -f ${shellQuote(unitPath)} ${shellQuote(request.configPath)} ${shellQuote(request.secretPath)}`,
    'systemctl daemon-reload 2>/dev/null || true',
    '',
  ].join('\n')
}

const runElevated = (scriptPath: string, prompt: string): Promise<boolean> =>
  new Promise((resolve) => {
    const done = (code: number | null) => resolve(code === 0)

    if (process.platform === 'darwin') {
      const script = `do shell script "sh ${scriptPath.replaceAll('"', '\\"')}" with administrator privileges with prompt "${prompt.replaceAll('"', '\\"')}"`
      const child = execFile('osascript', ['-e', script], () => {})

      child.once('exit', done)
      child.once('error', () => resolve(false))

      return
    }

    const child = execFile('pkexec', ['sh', scriptPath], () => {})

    child.once('exit', done)
    child.once('error', () => resolve(false))
  })

const withScript = async (body: string, prompt: string): Promise<boolean> => {
  const dir = mkdtempSync(join(tmpdir(), 'zashboard-helper-'))
  const scriptPath = join(dir, 'install.sh')

  try {
    writeFileSync(scriptPath, body, { encoding: 'utf8', mode: 0o700 })

    return await runElevated(scriptPath, prompt)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Whether this platform can host the helper service at all. */
export const helperSupported = (): boolean =>
  process.platform === 'linux' || process.platform === 'darwin'

export const installHelper = (request: HelperInstallRequest): Promise<boolean> =>
  withScript(installScript(request), request.prompt)

export const uninstallHelper = (request: HelperInstallRequest): Promise<boolean> =>
  withScript(uninstallScript(request), request.prompt)
