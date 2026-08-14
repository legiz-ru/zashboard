declare const __APP_VERSION__: string
declare const __COMMIT_ID__: string
// Build-time font selection: all | cdn | firasans | misans | pingfang | sarasa | none
declare const __FONT__: string

declare module 'vue-virtual-scroller'
declare interface Navigator {
  standalone?: boolean
}

// Bridge exposed by the Electron desktop shell (see desktop/src/preload).
// Mirrors desktop/src/shared/ipc.ts; kept as a hand-written declaration so the
// web build does not depend on the desktop workspace package.
declare type DesktopKernelStatus = 'stopped' | 'starting' | 'running' | 'errored'

declare type DesktopKernelState = {
  status: DesktopKernelStatus
  externalController: string
  secret: string
  mixedPort: number
  /** True while the kernel runs with administrator/root privileges. */
  elevated: boolean
  pid?: number
  error?: string
}

declare type DesktopKernelLogLine = {
  stream: 'stdout' | 'stderr'
  line: string
  ts: number
}

declare type DesktopKernelSource = 'mihomo' | 'smart'

declare type DesktopKernelVersion = { tag: string; label: string }

declare type DesktopTunStack = 'mixed' | 'gvisor' | 'system'

declare type DesktopTunStatus = {
  supported: boolean
  helperInstalled: boolean
  enabled: boolean
  stack: DesktopTunStack
  error?: string
}

declare type DesktopHotkeyAction =
  'toggleWindow' | 'toggleSystemProxy' | 'restartKernel' | 'modeRule' | 'modeGlobal' | 'modeDirect'

declare type DesktopHotkeysSnapshot = {
  bindings: Record<DesktopHotkeyAction, string>
  defaults: Record<DesktopHotkeyAction, string>
  failed: { action: DesktopHotkeyAction; accelerator: string }[]
}

declare type DesktopSettings = {
  /** Ask for administrator/root rights when starting the kernel (TUN mode). */
  elevateKernel: boolean
  systemProxy: boolean
  minimizeToTray: boolean
  launchAtLogin: boolean
  kernelPath: string
  kernelSource: DesktopKernelSource | ''
  kernelVersion: string
  hotkeys: Partial<Record<DesktopHotkeyAction, string>>
}

declare type DesktopSubscriptionInfo = {
  upload: number
  download: number
  total: number
  /** Unix seconds; 0 when the plan does not expire. */
  expire: number
}

declare type DesktopProfile = {
  id: string
  name: string
  type: 'local' | 'remote'
  url?: string
  /** Auto-update period in minutes; 0 disables it. */
  updateInterval?: number
  updatedAt: number
  subscriptionInfo?: DesktopSubscriptionInfo
}

declare type DesktopProfilesSnapshot = {
  profiles: DesktopProfile[]
  activeId?: string
}

declare type ZashboardDesktopApi = {
  appVersion: string
  kernelVersion: string
  platform: string
  arch: string
  endpoint: { url: string; secret: string }
  paths: { home: string; config: string; logs: string; kernelBinary: string }
  initialKernelState: DesktopKernelState
  initialSettings: DesktopSettings
  initialProfiles: DesktopProfilesSnapshot
  profiles: {
    list: () => Promise<DesktopProfilesSnapshot>
    importUrl: (url: string, name?: string) => Promise<DesktopProfilesSnapshot>
    importLocal: (name: string, content: string) => Promise<DesktopProfilesSnapshot>
    refresh: (id: string) => Promise<DesktopProfilesSnapshot>
    patch: (
      id: string,
      patch: { name?: string; updateInterval?: number },
    ) => Promise<DesktopProfilesSnapshot>
    remove: (id: string) => Promise<DesktopProfilesSnapshot>
    activate: (id: string) => Promise<DesktopProfilesSnapshot>
    content: (id: string) => Promise<string>
    onChange: (handler: (snapshot: DesktopProfilesSnapshot) => void) => () => void
  }
  kernel: {
    state: () => Promise<DesktopKernelState>
    start: () => Promise<DesktopKernelState>
    stop: () => Promise<DesktopKernelState>
    restart: () => Promise<DesktopKernelState>
    onState: (handler: (state: DesktopKernelState) => void) => () => void
    onLog: (handler: (line: DesktopKernelLogLine) => void) => () => void
  }
  settings: {
    get: () => Promise<DesktopSettings>
    patch: (patch: Partial<DesktopSettings>) => Promise<DesktopSettings>
    onChange: (handler: (settings: DesktopSettings) => void) => () => void
  }
  systemProxy: {
    get: () => Promise<boolean>
    set: (enabled: boolean) => Promise<DesktopSettings>
  }
  kernelSource: {
    versions: (source: DesktopKernelSource) => Promise<DesktopKernelVersion[]>
    switch: (source: DesktopKernelSource, tag: string) => Promise<DesktopSettings>
    useBundled: () => Promise<DesktopSettings>
  }
  tun: {
    status: () => Promise<DesktopTunStatus>
    enable: (stack: DesktopTunStack) => Promise<DesktopTunStatus>
    disable: () => Promise<DesktopTunStatus>
    uninstallHelper: () => Promise<DesktopTunStatus>
    onChange: (handler: (status: DesktopTunStatus) => void) => () => void
  }
  hotkeys: {
    get: () => Promise<DesktopHotkeysSnapshot>
    set: (bindings: Partial<Record<DesktopHotkeyAction, string>>) => Promise<DesktopHotkeysSnapshot>
  }
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximizeChange: (handler: (maximized: boolean) => void) => () => void
  }
  open: (target: 'config' | 'configDir' | 'logs') => Promise<void>
}

declare interface Window {
  zashboardDesktop?: ZashboardDesktopApi
}
