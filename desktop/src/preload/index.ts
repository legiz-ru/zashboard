import { contextBridge, ipcRenderer } from 'electron'
import type {
  BootstrapSnapshot,
  DesktopSettings,
  HotkeyAction,
  HotkeysSnapshot,
  KernelLogLine,
  KernelSource,
  KernelState,
  KernelVersion,
  OpenTarget,
  ProfilesSnapshot,
  TunStack,
  TunStatus,
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
  initialProfiles: bootstrap.profiles,
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
  profiles: {
    list: () => ipcRenderer.invoke(IPC.profilesList) as Promise<ProfilesSnapshot>,
    importUrl: (url: string, name?: string) =>
      ipcRenderer.invoke(IPC.profilesImportUrl, url, name) as Promise<ProfilesSnapshot>,
    importLocal: (name: string, content: string) =>
      ipcRenderer.invoke(IPC.profilesImportLocal, name, content) as Promise<ProfilesSnapshot>,
    refresh: (id: string) =>
      ipcRenderer.invoke(IPC.profilesRefresh, id) as Promise<ProfilesSnapshot>,
    patch: (id: string, patch: { name?: string; updateInterval?: number }) =>
      ipcRenderer.invoke(IPC.profilesPatch, id, patch) as Promise<ProfilesSnapshot>,
    remove: (id: string) => ipcRenderer.invoke(IPC.profilesRemove, id) as Promise<ProfilesSnapshot>,
    activate: (id: string) =>
      ipcRenderer.invoke(IPC.profilesActivate, id) as Promise<ProfilesSnapshot>,
    content: (id: string) => ipcRenderer.invoke(IPC.profilesContent, id) as Promise<string>,
    onChange: (handler: (snapshot: ProfilesSnapshot) => void) =>
      subscribe<ProfilesSnapshot>(IPC.onProfiles, handler),
  },
  /** The config the kernel is actually running, with the injected keys. */
  runtimeConfig: () => ipcRenderer.invoke(IPC.runtimeConfig) as Promise<string>,
  tun: {
    status: () => ipcRenderer.invoke(IPC.tunStatus) as Promise<TunStatus>,
    enable: (stack: TunStack) => ipcRenderer.invoke(IPC.tunEnable, stack) as Promise<TunStatus>,
    disable: () => ipcRenderer.invoke(IPC.tunDisable) as Promise<TunStatus>,
    uninstallHelper: () => ipcRenderer.invoke(IPC.tunUninstallHelper) as Promise<TunStatus>,
    onChange: (handler: (status: TunStatus) => void) => subscribe<TunStatus>(IPC.onTun, handler),
  },
  window: {
    minimize: () => ipcRenderer.send(IPC.windowMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.windowToggleMaximize),
    close: () => ipcRenderer.send(IPC.windowClose),
    isMaximized: () => ipcRenderer.invoke(IPC.windowIsMaximized) as Promise<boolean>,
    onMaximizeChange: (handler: (maximized: boolean) => void) =>
      subscribe<boolean>(IPC.onWindowMaximized, handler),
  },
  hotkeys: {
    get: () => ipcRenderer.invoke(IPC.hotkeysGet) as Promise<HotkeysSnapshot>,
    set: (bindings: Partial<Record<HotkeyAction, string>>) =>
      ipcRenderer.invoke(IPC.hotkeysSet, bindings) as Promise<HotkeysSnapshot>,
  },
  kernelSource: {
    versions: (source: KernelSource) =>
      ipcRenderer.invoke(IPC.kernelListVersions, source) as Promise<KernelVersion[]>,
    switch: (source: KernelSource, tag: string) =>
      ipcRenderer.invoke(IPC.kernelSwitchVersion, source, tag) as Promise<DesktopSettings>,
    useBundled: () => ipcRenderer.invoke(IPC.kernelUseBundled) as Promise<DesktopSettings>,
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
