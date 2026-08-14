// IPC channel names + payload shapes shared between the main process and the
// preload bridge. Keep this module dependency-free: it is bundled into both the
// (node) main bundle and the (sandboxed) preload bundle.

export const IPC = {
  /** Synchronous bootstrap snapshot, read once while the preload script runs. */
  bootstrap: 'zashboard:bootstrap',
  kernelState: 'zashboard:kernel:state',
  kernelLogs: 'zashboard:kernel:logs',
  kernelStart: 'zashboard:kernel:start',
  kernelStop: 'zashboard:kernel:stop',
  kernelRestart: 'zashboard:kernel:restart',
  profilesList: 'zashboard:profiles:list',
  profilesImportUrl: 'zashboard:profiles:import-url',
  profilesImportLocal: 'zashboard:profiles:import-local',
  profilesRefresh: 'zashboard:profiles:refresh',
  profilesPatch: 'zashboard:profiles:patch',
  profilesRemove: 'zashboard:profiles:remove',
  profilesActivate: 'zashboard:profiles:activate',
  profilesContent: 'zashboard:profiles:content',
  runtimeConfig: 'zashboard:runtime-config',
  tunStatus: 'zashboard:tun:status',
  tunEnable: 'zashboard:tun:enable',
  tunDisable: 'zashboard:tun:disable',
  tunUninstallHelper: 'zashboard:tun:uninstall-helper',
  onTun: 'zashboard:on:tun',
  windowMinimize: 'zashboard:window:minimize',
  windowToggleMaximize: 'zashboard:window:toggle-maximize',
  windowClose: 'zashboard:window:close',
  windowIsMaximized: 'zashboard:window:is-maximized',
  onWindowMaximized: 'zashboard:on:window-maximized',
  hotkeysGet: 'zashboard:hotkeys:get',
  hotkeysSet: 'zashboard:hotkeys:set',
  kernelListVersions: 'zashboard:kernel:list-versions',
  kernelSwitchVersion: 'zashboard:kernel:switch-version',
  kernelUseBundled: 'zashboard:kernel:use-bundled',
  settingsGet: 'zashboard:settings:get',
  settingsPatch: 'zashboard:settings:patch',
  systemProxyGet: 'zashboard:system-proxy:get',
  systemProxySet: 'zashboard:system-proxy:set',
  openPath: 'zashboard:open-path',
  /** main -> renderer pushes. */
  onKernelState: 'zashboard:on:kernel-state',
  onKernelLog: 'zashboard:on:kernel-log',
  onSettings: 'zashboard:on:settings',
  onProfiles: 'zashboard:on:profiles',
} as const

export type TunStack = 'mixed' | 'gvisor' | 'system'

export type TunStatus = {
  /** Whether this platform can host the privileged helper at all. */
  supported: boolean
  /** Whether an installed helper is reachable and authenticated. */
  helperInstalled: boolean
  /** Whether the active config has TUN on and the helper owns the kernel. */
  enabled: boolean
  stack: TunStack
  error?: string
}

export type HotkeyAction =
  'toggleWindow' | 'toggleSystemProxy' | 'restartKernel' | 'modeRule' | 'modeGlobal' | 'modeDirect'

export type HotkeysSnapshot = {
  bindings: Record<HotkeyAction, string>
  defaults: Record<HotkeyAction, string>
  /** Accelerators the OS refused, e.g. because another app holds them. */
  failed: { action: HotkeyAction; accelerator: string }[]
}

/** Upstream mihomo, or vernesong's fork carrying the Smart outbound group. */
export type KernelSource = 'mihomo' | 'smart'

export type KernelVersion = {
  /** Release tag used for the download. */
  tag: string
  /** What the UI shows; for a rolling release this carries the build sha. */
  label: string
}

export type SubscriptionInfo = {
  upload: number
  download: number
  total: number
  /** Unix seconds; 0 when the plan does not expire. */
  expire: number
}

export type ProfileMeta = {
  id: string
  name: string
  type: 'local' | 'remote'
  /** Subscription URL; remote profiles only. */
  url?: string
  /** Auto-update period in minutes; 0 disables it. Remote profiles only. */
  updateInterval?: number
  updatedAt: number
  subscriptionInfo?: SubscriptionInfo
}

export type ProfilesSnapshot = {
  profiles: ProfileMeta[]
  activeId?: string
}

export type KernelStatus = 'stopped' | 'starting' | 'running' | 'errored'

export type KernelState = {
  status: KernelStatus
  /** `host:port` the kernel's REST API is bound to. */
  externalController: string
  /** API secret injected into the active config before every spawn. */
  secret: string
  /** mihomo's mixed (http + socks) proxy port, used by the system-proxy toggle. */
  mixedPort: number
  /** True while the kernel runs with administrator/root privileges. */
  elevated: boolean
  pid?: number
  /** Populated when status is `errored`. */
  error?: string
}

export type KernelLogLine = {
  stream: 'stdout' | 'stderr'
  line: string
  ts: number
}

export type DesktopSettings = {
  /**
   * Ask for administrator/root rights when starting the kernel. Needed for TUN
   * mode; takes effect the next time the kernel starts.
   */
  elevateKernel: boolean
  /** Turn the OS proxy on whenever the kernel is running. */
  systemProxy: boolean
  /** Close/minimize hides to the tray instead of quitting. */
  minimizeToTray: boolean
  /** Launch the app when the user logs in. */
  launchAtLogin: boolean
  /** Absolute path to a user-supplied mihomo binary; empty = the bundled one. */
  kernelPath: string
  /** Which project `kernelPath` was downloaded from; empty when bundled. */
  kernelSource: KernelSource | ''
  /** Release tag `kernelPath` was downloaded from; empty when bundled. */
  kernelVersion: string
  /** Global shortcut bindings; an empty accelerator disables that action. */
  hotkeys: Partial<Record<HotkeyAction, string>>
}

export type OpenTarget = 'config' | 'configDir' | 'logs'

export type BootstrapSnapshot = {
  appVersion: string
  kernelVersion: string
  platform: NodeJS.Platform
  arch: string
  /** Base URL of the embedded kernel's REST API, e.g. `http://127.0.0.1:9090`. */
  endpoint: { url: string; secret: string }
  paths: { home: string; config: string; logs: string; kernelBinary: string }
  kernel: KernelState
  settings: DesktopSettings
  profiles: ProfilesSnapshot
}
