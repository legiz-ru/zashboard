import { contextBridge, ipcRenderer } from 'electron'
import type {
  BootstrapSnapshot,
  DesktopSettings,
  KernelLogLine,
  KernelState,
  OpenTarget,
} from '../shared/ipc'
import { IPC } from '../shared/ipc'

const subscribe = <T>(channel: string, handler: (payload: T) => void): (() => void) => {
  const listener = (_event: unknown, payload: T) => handler(payload)

  ipcRenderer.on(channel, listener)

  return () => ipcRenderer.off(channel, listener)
}

/**
 * The bootstrap snapshot is fetched synchronously so the dashboard can register
 * its embedded backend before Vue mounts — the router redirects to the setup
 * page when no backend exists, and an async hand-off would flash that page on
 * every launch.
 */
const bootstrap = ipcRenderer.sendSync(IPC.bootstrap) as BootstrapSnapshot

const api = {
  appVersion: bootstrap.appVersion,
  kernelVersion: bootstrap.kernelVersion,
  platform: bootstrap.platform,
  arch: bootstrap.arch,
  endpoint: bootstrap.endpoint,
  paths: bootstrap.paths,
  /** Snapshots taken while this preload ran; the `on*` streams take over after. */
  initialKernelState: bootstrap.kernel,
  initialSettings: bootstrap.settings,
  kernel: {
    state: () => ipcRenderer.invoke(IPC.kernelState) as Promise<KernelState>,
    start: () => ipcRenderer.invoke(IPC.kernelStart) as Promise<KernelState>,
    stop: () => ipcRenderer.invoke(IPC.kernelStop) as Promise<KernelState>,
    restart: () => ipcRenderer.invoke(IPC.kernelRestart) as Promise<KernelState>,
    onState: (handler: (state: KernelState) => void) =>
      subscribe<KernelState>(IPC.onKernelState, handler),
    onLog: (handler: (line: KernelLogLine) => void) =>
      subscribe<KernelLogLine>(IPC.onKernelLog, handler),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<DesktopSettings>,
    patch: (patch: Partial<DesktopSettings>) =>
      ipcRenderer.invoke(IPC.settingsPatch, patch) as Promise<DesktopSettings>,
    onChange: (handler: (settings: DesktopSettings) => void) =>
      subscribe<DesktopSettings>(IPC.onSettings, handler),
  },
  systemProxy: {
    get: () => ipcRenderer.invoke(IPC.systemProxyGet) as Promise<boolean>,
    set: (enabled: boolean) =>
      ipcRenderer.invoke(IPC.systemProxySet, enabled) as Promise<DesktopSettings>,
  },
  open: (target: OpenTarget) => ipcRenderer.invoke(IPC.openPath, target) as Promise<void>,
}

contextBridge.exposeInMainWorld('zashboardDesktop', api)

export type ZashboardDesktopApi = typeof api
