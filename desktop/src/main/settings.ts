import { readFileSync, writeFileSync } from 'node:fs'
import type { DesktopSettings } from '../shared/ipc'

export const DEFAULT_SETTINGS: DesktopSettings = {
  systemProxy: false,
  minimizeToTray: true,
  launchAtLogin: false,
  kernelPath: '',
}

const coerce = (raw: unknown): DesktopSettings => {
  const value = (raw ?? {}) as Partial<Record<keyof DesktopSettings, unknown>>
  const bool = (key: keyof DesktopSettings): boolean =>
    typeof value[key] === 'boolean' ? (value[key] as boolean) : (DEFAULT_SETTINGS[key] as boolean)

  return {
    systemProxy: bool('systemProxy'),
    minimizeToTray: bool('minimizeToTray'),
    launchAtLogin: bool('launchAtLogin'),
    kernelPath: typeof value.kernelPath === 'string' ? value.kernelPath : '',
  }
}

/**
 * Desktop-shell preferences, persisted as a small JSON file next to the kernel
 * data. Unreadable or corrupt files fall back to defaults rather than blocking
 * startup — losing a preference is recoverable, failing to boot is not.
 */
export class SettingsStore {
  private value: DesktopSettings

  constructor(private readonly path: string) {
    this.value = this.read()
  }

  get(): DesktopSettings {
    return { ...this.value }
  }

  patch(patch: Partial<DesktopSettings>): DesktopSettings {
    this.value = coerce({ ...this.value, ...patch })
    try {
      writeFileSync(this.path, `${JSON.stringify(this.value, null, 2)}\n`, 'utf8')
    } catch {
      // Read-only or full disk: keep the in-memory value for this session.
    }

    return this.get()
  }

  private read(): DesktopSettings {
    try {
      return coerce(JSON.parse(readFileSync(this.path, 'utf8')))
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }
}
