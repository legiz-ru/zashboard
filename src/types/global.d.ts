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
  pid?: number
  error?: string
}

declare type DesktopKernelLogLine = {
  stream: 'stdout' | 'stderr'
  line: string
  ts: number
}

declare type DesktopSettings = {
  systemProxy: boolean
  minimizeToTray: boolean
  launchAtLogin: boolean
  kernelPath: string
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
  open: (target: 'config' | 'configDir' | 'logs') => Promise<void>
}

declare interface Window {
  zashboardDesktop?: ZashboardDesktopApi
}
