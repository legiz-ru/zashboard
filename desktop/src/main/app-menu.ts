import type { MenuItemConstructorOptions } from 'electron'
import { Menu, shell } from 'electron'

export type AppMenuHandlers = {
  restartKernel: () => void
  toggleSystemProxy: () => void
  openConfigDir: () => void
  openLogsDir: () => void
  quit: () => void
}

/**
 * A real application menu, not just the tray: several Linux desktops ship
 * without a system tray, and without this the kernel/system-proxy controls
 * would be unreachable there.
 */
export const buildAppMenu = (handlers: AppMenuHandlers, systemProxy: boolean): void => {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Kernel',
      submenu: [
        { label: 'Restart kernel', click: handlers.restartKernel },
        {
          label: 'System proxy',
          type: 'checkbox',
          checked: systemProxy,
          click: handlers.toggleSystemProxy,
        },
        { type: 'separator' },
        { label: 'Open config folder', click: handlers.openConfigDir },
        { label: 'Open logs folder', click: handlers.openLogsDir },
        { type: 'separator' },
        isMac ? { role: 'close' } : { label: 'Quit', click: handlers.quit },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'zashboard on GitHub',
          click: () => void shell.openExternal('https://github.com/Zephyruso/zashboard'),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
