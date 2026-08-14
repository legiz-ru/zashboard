import { globalShortcut } from 'electron'
import type { HotkeyAction, HotkeysSnapshot } from '../shared/ipc'

/**
 * Shipping defaults. Deliberately conservative: global shortcuts are taken from
 * every other app on the machine, so only the actions worth a system-wide key
 * get one, and each uses a modifier combination that is rare in editors.
 */
export const DEFAULT_HOTKEYS: Record<HotkeyAction, string> = {
  toggleWindow: 'CommandOrControl+Shift+Z',
  toggleSystemProxy: 'CommandOrControl+Shift+P',
  restartKernel: '',
  modeRule: '',
  modeGlobal: '',
  modeDirect: '',
}

export const HOTKEY_ACTIONS = Object.keys(DEFAULT_HOTKEYS) as HotkeyAction[]

export type HotkeyHandlers = Record<HotkeyAction, () => void>

/**
 * Owns the process-wide shortcut registrations.
 *
 * Registration can fail for reasons outside our control — another app already
 * holds the combination, or the accelerator is malformed — so failures are
 * collected and reported back to the UI instead of throwing: a shortcut the OS
 * refuses must not stop the rest from binding.
 */
export class Hotkeys {
  private bindings: Record<HotkeyAction, string>
  private failed: { action: HotkeyAction; accelerator: string }[] = []

  constructor(
    private readonly handlers: HotkeyHandlers,
    bindings: Partial<Record<HotkeyAction, string>> = {},
  ) {
    this.bindings = { ...DEFAULT_HOTKEYS, ...this.sanitize(bindings) }
  }

  snapshot(): HotkeysSnapshot {
    return {
      bindings: { ...this.bindings },
      defaults: { ...DEFAULT_HOTKEYS },
      failed: this.failed.map((entry) => ({ ...entry })),
    }
  }

  /** Apply the current bindings, replacing whatever was registered before. */
  apply(): HotkeysSnapshot {
    globalShortcut.unregisterAll()
    this.failed = []

    for (const action of HOTKEY_ACTIONS) {
      const accelerator = this.bindings[action]

      // An empty binding is how a user turns a shortcut off.
      if (!accelerator) continue

      try {
        if (!globalShortcut.register(accelerator, () => this.handlers[action]())) {
          this.failed.push({ action, accelerator })
        }
      } catch {
        this.failed.push({ action, accelerator })
      }
    }

    return this.snapshot()
  }

  set(bindings: Partial<Record<HotkeyAction, string>>): HotkeysSnapshot {
    this.bindings = { ...this.bindings, ...this.sanitize(bindings) }

    return this.apply()
  }

  dispose(): void {
    globalShortcut.unregisterAll()
  }

  private sanitize(
    bindings: Partial<Record<HotkeyAction, string>>,
  ): Partial<Record<HotkeyAction, string>> {
    const clean: Partial<Record<HotkeyAction, string>> = {}

    for (const action of HOTKEY_ACTIONS) {
      const value = bindings[action]

      if (typeof value === 'string') clean[action] = value.trim()
    }

    return clean
  }
}
