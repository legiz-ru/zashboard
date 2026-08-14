import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  BootstrapSnapshot,
  DesktopSettings,
  HotkeyAction,
  KernelSource,
  KernelState,
  OpenTarget,
  ProfilesSnapshot,
  TunStack,
  TunStatus,
} from '../shared/ipc'
import { IPC } from '../shared/ipc'
import { buildAppMenu } from './app-menu'
import { resolveDefaultConfig, resolveKernelBinary } from './binary-path'
import { findFreePort } from './free-port'
import { callHelper, helperAvailable, helperPaths } from './helper-client'
import { helperSupported, installHelper, uninstallHelper } from './helper-installer'
import { Hotkeys } from './hotkeys'
import { Kernel } from './kernel'
import { downloadKernel, listKernelVersions } from './kernel-source'
import { createLogFile } from './log-file'
import { bootstrapDataDir } from './paths'
import { ProfileStore } from './profiles'
import { APP_INDEX, APP_ORIGIN, registerAppScheme, serveRenderer } from './protocol'
import { SettingsStore } from './settings'
import { isSystemProxyEnabled, setSystemProxy } from './sysproxy'
import { createTray } from './tray'
import { readTunState, writeTunBlock } from './tun'

/** mihomo's conventional REST API port; reused whenever it is free. */
const PREFERRED_API_PORT = 9090
/** mihomo's conventional mixed proxy port, used when the config omits one. */
const DEFAULT_MIXED_PORT = 7890
/** Shown in the confirmation dialog and inside the OS authorization prompt. */
const ELEVATION_PROMPT = 'zashboard needs administrator rights to run the mihomo kernel.'

// Without this the app name comes from the package name (`@zashboard/desktop`)
// and userData lands in a nested `@zashboard/desktop` directory.
app.setName('zashboard')

const isPackaged = app.isPackaged
const appRoot = app.getAppPath()
/** Set by scripts/dev.mjs to load the live Vite dev server instead of the build. */
const rendererDevUrl = !isPackaged ? (process.env.ZASHBOARD_RENDERER_URL ?? '') : ''

registerAppScheme()

let window: BrowserWindow | null = null
let tray: ReturnType<typeof createTray> | null = null
let kernel: Kernel | null = null
let settings: SettingsStore | null = null
let profiles: ProfileStore | null = null
let hotkeys: Hotkeys | null = null
let quitting = false
/** True once we have pointed the OS proxy at the kernel, so we can undo it. */
let systemProxyApplied = false

const binaryInput = {
  platform: process.platform,
  isPackaged,
  resourcesPath: process.resourcesPath,
  appPath: appRoot,
}

const rendererDir = isPackaged ? join(process.resourcesPath, 'renderer') : join(appRoot, 'renderer')

const broadcast = (channel: string, payload: unknown): void => {
  for (const target of BrowserWindow.getAllWindows()) {
    if (!target.isDestroyed()) target.webContents.send(channel, payload)
  }
}

/**
 * The API secret is generated once per install and persisted: the dashboard
 * stores the backend it was handed, so a secret that changed every launch would
 * leave a stale, unusable entry behind after each restart.
 */
const loadSecret = (userData: string): string => {
  const path = join(userData, 'api-secret.txt')

  try {
    const existing = readFileSync(path, 'utf8').trim()

    if (existing.length > 0) return existing
  } catch {
    // First run, or an unreadable file — fall through and mint a new one.
  }

  const secret = randomBytes(16).toString('hex')

  try {
    writeFileSync(path, secret, { encoding: 'utf8', mode: 0o600 })
  } catch {
    // Non-persistable secret: still usable for this session.
  }

  return secret
}

/**
 * Ask before triggering the OS authorization dialog. The prompt itself carries
 * no context on Windows/Linux, so this is where the user learns which app is
 * asking and why — and gets a way out that still leaves them with a proxy.
 */
const confirmElevation = async (): Promise<boolean> => {
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Continue', 'Start without privileges'],
    defaultId: 0,
    cancelId: 1,
    title: 'zashboard',
    message: ELEVATION_PROMPT,
    detail:
      'Administrator rights are required for TUN mode. Without them the kernel still runs, but only as a local proxy.',
  })

  return response === 0
}

const applySystemProxy = async (enabled: boolean): Promise<void> => {
  const state = kernel?.getState()

  try {
    if (enabled && state?.status === 'running') {
      await setSystemProxy(state.mixedPort)
      systemProxyApplied = true
    } else if (!enabled && systemProxyApplied) {
      await setSystemProxy(null)
      systemProxyApplied = false
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    dialog.showErrorBox('System proxy', `Could not update the system proxy settings.\n\n${message}`)
  }
}

const quitApp = (): void => {
  quitting = true
  app.quit()
}

const toggleSystemProxy = (enabled: boolean): void => {
  settings?.patch({ systemProxy: enabled })
  void applySystemProxy(enabled).then(() => {
    broadcast(IPC.onSettings, settings?.get())
    renderChrome()
  })
}

/** Repaint the tray + application menu against the current kernel/settings. */
const renderChrome = (): void => {
  if (!kernel || !settings) return

  const { systemProxy } = settings.get()

  tray?.render({ kernel: kernel.getState(), systemProxy })
  buildAppMenu(
    {
      restartKernel: () => void kernel?.restart().catch(() => {}),
      toggleSystemProxy: () => toggleSystemProxy(!settings?.get().systemProxy),
      openConfigDir: () => openTarget('configDir'),
      openLogsDir: () => openTarget('logs'),
      quit: quitApp,
    },
    systemProxy,
  )
}

const showWindow = (): void => {
  if (!window) {
    createWindow()
    return
  }

  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

const createWindow = (): void => {
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1d232a',
    title: 'zashboard',
    // Frameless with an in-page title bar. macOS keeps its traffic lights via
    // hiddenInset (users expect them where the OS puts them); the other
    // platforms get the buttons the renderer draws.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 12, y: 10 } }
      : { frame: false }),
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  window.once('ready-to-show', () => window?.show())

  window.on('close', (event) => {
    if (quitting || !settings?.get().minimizeToTray) return
    event.preventDefault()
    window?.hide()
  })

  window.on('closed', () => {
    window = null
  })

  window.on('maximize', () => broadcast(IPC.onWindowMaximized, true))
  window.on('unmaximize', () => broadcast(IPC.onWindowMaximized, false))

  // The renderer only ever talks to its own origin; anything else (a proxy
  // provider's homepage, a subscription link) belongs in the user's browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url)

    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    const allowed = rendererDevUrl || APP_ORIGIN

    if (!url.startsWith(allowed)) {
      event.preventDefault()
      if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url)
    }
  })

  void window.loadURL(rendererDevUrl || APP_INDEX)
}

const openTarget = (target: OpenTarget): void => {
  const paths = bootstrapPaths()

  if (target === 'config') void shell.openPath(paths.configPath)
  else if (target === 'configDir') void shell.openPath(dirname(paths.configPath))
  else void shell.openPath(paths.logsDir)
}

let cachedPaths: ReturnType<typeof bootstrapDataDir> | null = null
const bootstrapPaths = (): ReturnType<typeof bootstrapDataDir> => {
  if (cachedPaths) return cachedPaths

  const defaultConfigPath = resolveDefaultConfig(binaryInput)
  const defaultConfig = existsSync(defaultConfigPath)
    ? readFileSync(defaultConfigPath, 'utf8')
    : 'mixed-port: 7890\nmode: rule\nrules:\n  - MATCH,DIRECT\n'

  cachedPaths = bootstrapDataDir(app.getPath('userData'), defaultConfig)

  return cachedPaths
}

const registerIpc = (snapshot: () => BootstrapSnapshot): void => {
  ipcMain.on(IPC.bootstrap, (event) => {
    event.returnValue = snapshot()
  })

  ipcMain.handle(IPC.kernelState, () => kernel?.getState() ?? null)
  ipcMain.handle(IPC.kernelStart, async () => {
    await kernel?.start()

    return kernel?.getState() ?? null
  })
  ipcMain.handle(IPC.kernelStop, async () => {
    await kernel?.stop()

    return kernel?.getState() ?? null
  })
  ipcMain.handle(IPC.kernelRestart, async () => {
    await kernel?.restart()

    return kernel?.getState() ?? null
  })

  ipcMain.handle(IPC.settingsGet, () => settings?.get() ?? null)
  ipcMain.handle(IPC.settingsPatch, async (_event, patch: Partial<DesktopSettings>) => {
    if (!settings) return null

    const before = settings.get()
    const next = settings.patch(patch)

    if (next.launchAtLogin !== before.launchAtLogin) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
    }
    if (next.systemProxy !== before.systemProxy) {
      await applySystemProxy(next.systemProxy)
    }
    if (next.kernelPath !== before.kernelPath) {
      kernel?.setBinaryPath(resolveKernelBinary({ ...binaryInput, userOverride: next.kernelPath }))
    }

    broadcast(IPC.onSettings, next)
    renderChrome()

    return next
  })

  ipcMain.handle(IPC.systemProxyGet, () => isSystemProxyEnabled())
  ipcMain.handle(IPC.systemProxySet, async (_event, enabled: boolean) => {
    settings?.patch({ systemProxy: enabled })
    await applySystemProxy(enabled)
    broadcast(IPC.onSettings, settings?.get())
    renderChrome()

    return settings?.get() ?? null
  })

  ipcMain.handle(IPC.openPath, (_event, target: OpenTarget) => openTarget(target))

  registerProfileIpc()
  registerKernelSourceIpc()
  registerHotkeyIpc()
  registerWindowIpc()
  registerTunIpc()
}

/**
 * TUN needs a privileged kernel. Rather than elevating the GUI, the app hands
 * the kernel to a root helper service: the app's own supervisor stops its
 * unprivileged child, the helper starts mihomo with the TUN block in place, and
 * the dashboard keeps talking to the same REST endpoint either way.
 */
const helperSecretFor = (userData: string): string => {
  const path = join(userData, 'helper-secret.txt')

  try {
    const existing = readFileSync(path, 'utf8').trim()

    if (existing) return existing
  } catch {
    // First use — mint one below.
  }

  const secret = randomBytes(24).toString('hex')

  try {
    writeFileSync(path, secret, { encoding: 'utf8', mode: 0o600 })
  } catch {
    // Non-persistable: TUN will simply need re-installing next launch.
  }

  return secret
}

const helperInstallRequest = () => {
  const userData = app.getPath('userData')
  const paths = helperPaths()

  return {
    electronPath: process.execPath,
    // Must be a real on-disk file: an OS service cannot execute a path inside
    // app.asar (see asarUnpack in electron-builder.yml).
    helperEntry: isPackaged
      ? join(appRoot, '..', 'app.asar.unpacked', 'out', 'helper', 'index.cjs')
      : join(appRoot, 'out', 'helper', 'index.cjs'),
    socketPath: paths.socketPath,
    secretPath: paths.secretPath,
    configPath: paths.configPath,
    secret: helperSecretFor(userData),
    binaryPath: resolveKernelBinary({ ...binaryInput, userOverride: settings?.get().kernelPath }),
    homeDir: bootstrapPaths().homeDir,
    kernelConfigPath: bootstrapPaths().configPath,
    prompt: 'zashboard needs administrator rights to install its TUN helper service.',
  }
}

const tunStatus = async (): Promise<TunStatus> => {
  const request = helperInstallRequest()
  const supported = helperSupported()
  const helperInstalled = supported && (await helperAvailable(request.socketPath, request.secret))
  const { enabled, stack } = await readTunState(bootstrapPaths().configPath)

  return { supported, helperInstalled, enabled: enabled && helperInstalled, stack }
}

const publishTun = async (): Promise<TunStatus> => {
  const status = await tunStatus()

  broadcast(IPC.onTun, status)

  return status
}

const registerTunIpc = (): void => {
  ipcMain.handle(IPC.tunStatus, () => tunStatus())

  ipcMain.handle(IPC.tunEnable, async (_event, stack: TunStack) => {
    const request = helperInstallRequest()

    if (!helperSupported()) {
      return {
        ...(await tunStatus()),
        error:
          'TUN through a helper service is only available on Linux and macOS. On Windows, enable "Run kernel as administrator" instead.',
      } satisfies TunStatus
    }

    if (!(await helperAvailable(request.socketPath, request.secret))) {
      if (!(await installHelper(request))) {
        return { ...(await tunStatus()), error: 'the helper could not be installed' }
      }
      // launchctl/systemd return before the daemon has bound its socket.
      for (let attempt = 0; attempt < 20; attempt++) {
        if (await helperAvailable(request.socketPath, request.secret)) break
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }

    await writeTunBlock(bootstrapPaths().configPath, stack)
    // Only one process may own the kernel: ours steps aside before the helper
    // starts a privileged one against the same config and API port.
    await kernel?.stop()
    await callHelper(request.socketPath, request.secret, 'start')

    return publishTun()
  })

  ipcMain.handle(IPC.tunDisable, async () => {
    const request = helperInstallRequest()

    if (await helperAvailable(request.socketPath, request.secret)) {
      await callHelper(request.socketPath, request.secret, 'stop')
    }

    await writeTunBlock(bootstrapPaths().configPath, null)
    await kernel?.start()

    return publishTun()
  })

  ipcMain.handle(IPC.tunUninstallHelper, async () => {
    const request = helperInstallRequest()

    if (await helperAvailable(request.socketPath, request.secret)) {
      await callHelper(request.socketPath, request.secret, 'stop')
    }

    await uninstallHelper(request)
    await writeTunBlock(bootstrapPaths().configPath, null)
    await kernel?.start()

    return publishTun()
  })
}

/** Window controls for the in-page title bar of the frameless window. */
const registerWindowIpc = (): void => {
  ipcMain.on(IPC.windowMinimize, () => window?.minimize())
  ipcMain.on(IPC.windowToggleMaximize, () => {
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  // Closing follows the same rule as the window's own close button: hide to the
  // tray unless the user asked for a real quit.
  ipcMain.on(IPC.windowClose, () => window?.close())
  ipcMain.handle(IPC.windowIsMaximized, () => window?.isMaximized() ?? false)
}

/** Switch mihomo's routing mode through its own REST API. */
const setKernelMode = async (mode: 'rule' | 'global' | 'direct'): Promise<void> => {
  const endpoint = kernel?.endpoint

  if (!endpoint || kernel?.getState().status !== 'running') return

  try {
    await fetch(`${endpoint.url}/configs`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${endpoint.secret}`,
      },
      body: JSON.stringify({ mode }),
    })
  } catch {
    // The kernel may be restarting; the shortcut is fire-and-forget.
  }
}

const registerHotkeyIpc = (): void => {
  ipcMain.handle(IPC.hotkeysGet, () => hotkeys?.snapshot() ?? null)
  ipcMain.handle(IPC.hotkeysSet, (_event, bindings: Partial<Record<HotkeyAction, string>>) => {
    const snapshot = hotkeys?.set(bindings) ?? null

    if (snapshot) {
      const next = settings?.patch({ hotkeys: snapshot.bindings })

      broadcast(IPC.onSettings, next)
    }

    return snapshot
  })
}

const registerKernelSourceIpc = (): void => {
  ipcMain.handle(IPC.kernelListVersions, (_event, source: KernelSource) =>
    listKernelVersions(source),
  )

  ipcMain.handle(IPC.kernelSwitchVersion, async (_event, source: KernelSource, tag: string) => {
    const destDir = join(app.getPath('userData'), 'kernels', `${source}-${tag}`)
    const binPath = await downloadKernel(source, tag, destDir, process.platform, process.arch)

    // Persist before swapping: a crash mid-restart should still come back on the
    // kernel the user picked.
    const next = settings?.patch({
      kernelPath: binPath,
      kernelSource: source,
      kernelVersion: tag,
    })

    kernel?.setBinaryPath(binPath)
    await kernel?.restart()
    broadcast(IPC.onSettings, next)

    return next ?? null
  })

  ipcMain.handle(IPC.kernelUseBundled, async () => {
    const next = settings?.patch({ kernelPath: '', kernelSource: '', kernelVersion: '' })

    kernel?.setBinaryPath(resolveKernelBinary(binaryInput))
    await kernel?.restart()
    broadcast(IPC.onSettings, next)

    return next ?? null
  })
}

const profilesSnapshot = (): ProfilesSnapshot => ({
  profiles: profiles?.list() ?? [],
  activeId: profiles?.activeId(),
})

const publishProfiles = (): ProfilesSnapshot => {
  const snapshot = profilesSnapshot()

  broadcast(IPC.onProfiles, snapshot)

  return snapshot
}

const registerProfileIpc = (): void => {
  ipcMain.handle(IPC.profilesList, () => profilesSnapshot())

  ipcMain.handle(IPC.profilesImportUrl, async (_event, url: string, name?: string) => {
    await profiles?.importFromUrl(url, name)

    return publishProfiles()
  })

  ipcMain.handle(IPC.profilesImportLocal, async (_event, name: string, content: string) => {
    await profiles?.importLocal(name, content)

    return publishProfiles()
  })

  ipcMain.handle(IPC.profilesRefresh, async (_event, id: string) => {
    await profiles?.refresh(id)

    return publishProfiles()
  })

  ipcMain.handle(
    IPC.profilesPatch,
    async (_event, id: string, patch: { name?: string; updateInterval?: number }) => {
      await profiles?.patch(id, patch)

      return publishProfiles()
    },
  )

  ipcMain.handle(IPC.profilesRemove, async (_event, id: string) => {
    await profiles?.remove(id)

    return publishProfiles()
  })

  ipcMain.handle(IPC.profilesActivate, async (_event, id: string) => {
    await profiles?.setActive(id)

    return publishProfiles()
  })

  ipcMain.handle(IPC.profilesContent, (_event, id: string) => profiles?.content(id) ?? '')
}

/**
 * Import a subscription handed to the app as a `clash://install-config?url=…`
 * deep link (the "one-click import" button subscription providers ship).
 */
const importDeepLink = async (rawUrl: string): Promise<void> => {
  let target: string | null = null

  try {
    const parsed = new URL(rawUrl)

    if (parsed.protocol === 'clash:' || parsed.protocol === 'clashmeta:') {
      target = parsed.searchParams.get('url')
    }
  } catch {
    return
  }

  if (!target || !profiles) return

  try {
    const imported = await profiles.importFromUrl(target)

    await profiles.setActive(imported.id)
    publishProfiles()
    showWindow()
  } catch (error) {
    dialog.showErrorBox(
      'Subscription import',
      error instanceof Error ? error.message : String(error),
    )
  }
}

const boot = async (): Promise<void> => {
  const userData = app.getPath('userData')
  const paths = bootstrapPaths()

  settings = new SettingsStore(paths.settingsPath)

  const desktopSettings = settings.get()
  const secret = loadSecret(userData)
  const apiPort = await findFreePort(PREFERRED_API_PORT)
  const kernelLog = createLogFile(paths.logsDir, 'kernel.log')

  kernel = new Kernel({
    binaryPath: resolveKernelBinary({ ...binaryInput, userOverride: desktopSettings.kernelPath }),
    homeDir: paths.homeDir,
    configPath: paths.configPath,
    externalController: `127.0.0.1:${apiPort}`,
    secret,
    defaultMixedPort: DEFAULT_MIXED_PORT,
    stopFile: join(userData, 'kernel.stop'),
    logFile: join(paths.logsDir, 'kernel.log'),
    scriptDir: userData,
    // Read at every start, so flipping the setting takes effect on the next
    // kernel restart without rebuilding the supervisor.
    shouldElevate: () => settings?.get().elevateKernel ?? false,
    confirmElevation,
    elevationPrompt: ELEVATION_PROMPT,
  })

  profiles = new ProfileStore({
    dir: join(userData, 'profiles'),
    activeConfigPath: paths.configPath,
    validate: (configPath) =>
      kernel?.validate(configPath) ?? Promise.resolve({ valid: false, message: 'no kernel' }),
    // Activating a profile replaces the config the kernel was started with, so
    // it only takes effect after a restart.
    applied: async () => {
      await kernel?.restart()
    },
  })
  profiles.startScheduler()

  hotkeys = new Hotkeys(
    {
      toggleWindow: () =>
        window?.isVisible() && window.isFocused() ? window.hide() : showWindow(),
      toggleSystemProxy: () => toggleSystemProxy(!settings?.get().systemProxy),
      restartKernel: () => void kernel?.restart().catch(() => {}),
      modeRule: () => void setKernelMode('rule'),
      modeGlobal: () => void setKernelMode('global'),
      modeDirect: () => void setKernelMode('direct'),
    },
    desktopSettings.hotkeys,
  )
  hotkeys.apply()

  kernel.on('log', (line) => {
    kernelLog.write(line.line)
    broadcast(IPC.onKernelLog, line)
  })

  kernel.on('state', (state: KernelState) => {
    broadcast(IPC.onKernelState, state)
    renderChrome()

    // Re-point the OS proxy whenever the kernel comes back up: a restart may
    // have landed on a different mixed port, and a proxy aimed at the old one
    // would black-hole every request.
    if (state.status === 'running' && settings?.get().systemProxy) {
      void applySystemProxy(true)
    }
  })

  serveRenderer(rendererDir)

  registerIpc(() => ({
    appVersion: app.getVersion(),
    kernelVersion: process.env.ZASHBOARD_MIHOMO_VERSION ?? '',
    platform: process.platform,
    arch: process.arch,
    endpoint: kernel?.endpoint ?? { url: '', secret: '' },
    paths: {
      home: paths.homeDir,
      config: paths.configPath,
      logs: paths.logsDir,
      kernelBinary: resolveKernelBinary({
        ...binaryInput,
        userOverride: settings?.get().kernelPath,
      }),
    },
    kernel: kernel?.getState() ?? {
      status: 'stopped',
      externalController: `127.0.0.1:${apiPort}`,
      secret,
      mixedPort: DEFAULT_MIXED_PORT,
      elevated: false,
    },
    settings: settings?.get() ?? desktopSettings,
    profiles: profilesSnapshot(),
  }))

  tray = createTray(
    isPackaged ? join(process.resourcesPath, 'tray.png') : join(appRoot, 'resources', 'tray.png'),
    {
      show: showWindow,
      restartKernel: () => void kernel?.restart().catch(() => {}),
      toggleSystemProxy,
      openConfigDir: () => openTarget('configDir'),
      openLogsDir: () => openTarget('logs'),
      quit: quitApp,
    },
  )
  renderChrome()

  // The window paints against the already-served renderer while the kernel
  // boots; zashboard retries its backend connection on its own, so there is no
  // reason to make the user watch a blank screen wait on mihomo.
  createWindow()

  const binary = resolveKernelBinary({ ...binaryInput, userOverride: desktopSettings.kernelPath })

  if (!existsSync(binary)) {
    dialog.showErrorBox(
      'mihomo not found',
      `The bundled kernel is missing at:\n${binary}\n\nRun "pnpm --filter @zashboard/desktop fetch:mihomo" before building, or set a kernel path in the desktop settings.`,
    )
    return
  }

  await kernel.start().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)

    kernelLog.write(`[app] kernel failed to start: ${message}`)
  })
}

const singleInstance = app.requestSingleInstanceLock()

const deepLinkFrom = (argv: string[]): string | undefined =>
  argv.find((arg) => arg.startsWith('clash://') || arg.startsWith('clashmeta://'))

if (!singleInstance) {
  app.quit()
} else {
  // A clash:// link opened while the app runs arrives as a second instance on
  // Windows/Linux (in argv) and as `open-url` on macOS.
  app.on('second-instance', (_event, argv) => {
    showWindow()

    const link = deepLinkFrom(argv)

    if (link) void importDeepLink(link)
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    void importDeepLink(url)
  })

  app.whenReady().then(async () => {
    for (const scheme of ['clash', 'clashmeta']) app.setAsDefaultProtocolClient(scheme)

    await boot()

    // A link that launched the app is only importable once the profile store
    // exists, so this waits for boot() rather than racing it.
    const link = deepLinkFrom(process.argv)

    if (link) void importDeepLink(link)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
      else showWindow()
    })
  })

  app.on('window-all-closed', () => {
    // The tray keeps the app alive on every platform: killing the kernel just
    // because a window closed would drop the user's connection.
    if (process.platform !== 'darwin' && !settings?.get().minimizeToTray) app.quit()
  })

  app.on('before-quit', (event) => {
    if (quitting) return

    quitting = true
    event.preventDefault()

    const shutdown = async () => {
      hotkeys?.dispose()
      profiles?.stopScheduler()
      if (systemProxyApplied) await applySystemProxy(false)
      await kernel?.stop()
      tray?.destroy()
      app.exit(0)
    }

    void shutdown().catch(() => app.exit(1))
  })
}
