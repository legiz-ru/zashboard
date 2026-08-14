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
  settingsGet: 'zashboard:settings:get',
  settingsPatch: 'zashboard:settings:patch',
  systemProxyGet: 'zashboard:system-proxy:get',
  systemProxySet: 'zashboard:system-proxy:set',
  openPath: 'zashboard:open-path',
  /** main -> renderer pushes. */
  onKernelState: 'zashboard:on:kernel-state',
  onKernelLog: 'zashboard:on:kernel-log',
  onSettings: 'zashboard:on:settings',
} as const

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
}
