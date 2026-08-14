import { Menu, Tray, nativeImage } from 'electron'
import type { KernelState } from '../shared/ipc'

export type TrayHandlers = {
  show: () => void
  restartKernel: () => void
  toggleSystemProxy: (enabled: boolean) => void
  openConfigDir: () => void
  openLogsDir: () => void
  quit: () => void
}

export type TrayView = {
  kernel: KernelState
  systemProxy: boolean
}

const STATUS_LABEL: Record<KernelState['status'], string> = {
  stopped: 'Kernel: stopped',
  starting: 'Kernel: starting…',
  running: 'Kernel: running',
  errored: 'Kernel: error',
}

/**
 * The tray is the app's control surface while the window is hidden: kernel
 * state at a glance, plus the two actions a user needs without opening the
 * dashboard (restart the kernel, toggle the system proxy).
 */
export const createTray = (iconPath: string, handlers: TrayHandlers) => {
  const image = nativeImage.createFromPath(iconPath)
  // macOS menu bar wants a small template image; the raw 512px icon would be
  // scaled by the OS into a blurry mess.
  const icon = image.isEmpty() ? image : image.resize({ width: 16, height: 16 })

  if (process.platform === 'darwin') icon.setTemplateImage(true)

  const tray = new Tray(icon)

  tray.setToolTip('zashboard')
  tray.on('click', handlers.show)
  tray.on('double-click', handlers.show)

  const render = (view: TrayView): void => {
    const status = STATUS_LABEL[view.kernel.status]

    tray.setToolTip(`zashboard — ${status}`)
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open zashboard', click: handlers.show },
        { type: 'separator' },
        { label: status, enabled: false },
        ...(view.kernel.error ? [{ label: view.kernel.error, enabled: false }] : []),
        { label: 'Restart kernel', click: handlers.restartKernel },
        {
          label: 'System proxy',
          type: 'checkbox' as const,
          checked: view.systemProxy,
          click: () => handlers.toggleSystemProxy(!view.systemProxy),
        },
        { type: 'separator' },
        { label: 'Open config folder', click: handlers.openConfigDir },
        { label: 'Open logs folder', click: handlers.openLogsDir },
        { type: 'separator' },
        { label: 'Quit', click: handlers.quit },
      ]),
    )
  }

  return { tray, render, destroy: () => tray.destroy() }
}
