import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Hosts that must never be routed through the proxy. */
const BYPASS = [
  'localhost',
  '127.*',
  '10.*',
  '172.16.*',
  '172.17.*',
  '172.18.*',
  '172.19.*',
  '172.2*',
  '172.30.*',
  '172.31.*',
  '192.168.*',
  '<local>',
]

const MAC_BYPASS = ['127.0.0.1', 'localhost', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']

const WININET_REFRESH = [
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  [
    'Add-Type -Namespace Zashboard -Name WinINet -MemberDefinition',
    // INTERNET_OPTION_SETTINGS_CHANGED (39) + INTERNET_OPTION_REFRESH (37) make
    // WinINet clients pick the new settings up without a logout.
    '\'[DllImport("wininet.dll", SetLastError=true)] public static extern bool InternetSetOption(System.IntPtr h, int o, System.IntPtr b, int l);\';',
    '[void][Zashboard.WinINet]::InternetSetOption([System.IntPtr]::Zero, 39, [System.IntPtr]::Zero, 0);',
    '[void][Zashboard.WinINet]::InternetSetOption([System.IntPtr]::Zero, 37, [System.IntPtr]::Zero, 0)',
  ].join(' '),
]

const INTERNET_SETTINGS = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'

const macNetworkServices = async (): Promise<string[]> => {
  const { stdout } = await run('networksetup', ['-listallnetworkservices'])

  return (
    stdout
      .split('\n')
      .slice(1) // First line is an explanatory header.
      .map((line) => line.trim())
      // A leading '*' marks a disabled service.
      .filter((line) => line.length > 0 && !line.startsWith('*'))
  )
}

const setWindowsProxy = async (server: string | null): Promise<void> => {
  if (server) {
    await run('reg', [
      'add',
      INTERNET_SETTINGS,
      '/v',
      'ProxyServer',
      '/t',
      'REG_SZ',
      '/d',
      server,
      '/f',
    ])
    await run('reg', [
      'add',
      INTERNET_SETTINGS,
      '/v',
      'ProxyOverride',
      '/t',
      'REG_SZ',
      '/d',
      BYPASS.join(';'),
      '/f',
    ])
  }

  await run('reg', [
    'add',
    INTERNET_SETTINGS,
    '/v',
    'ProxyEnable',
    '/t',
    'REG_DWORD',
    '/d',
    server ? '1' : '0',
    '/f',
  ])
  await run('powershell', WININET_REFRESH)
}

const setMacProxy = async (port: number | null): Promise<void> => {
  for (const service of await macNetworkServices()) {
    if (port === null) {
      await run('networksetup', ['-setwebproxystate', service, 'off'])
      await run('networksetup', ['-setsecurewebproxystate', service, 'off'])
      await run('networksetup', ['-setsocksfirewallproxystate', service, 'off'])
      continue
    }

    const target = ['127.0.0.1', String(port)]

    await run('networksetup', ['-setwebproxy', service, ...target])
    await run('networksetup', ['-setsecurewebproxy', service, ...target])
    await run('networksetup', ['-setsocksfirewallproxy', service, ...target])
    await run('networksetup', ['-setproxybypassdomains', service, ...MAC_BYPASS])
  }
}

const setLinuxProxy = async (port: number | null): Promise<void> => {
  if (port === null) {
    await run('gsettings', ['set', 'org.gnome.system.proxy', 'mode', 'none'])
    return
  }

  for (const protocol of ['http', 'https', 'socks']) {
    await run('gsettings', ['set', `org.gnome.system.proxy.${protocol}`, 'host', '127.0.0.1'])
    await run('gsettings', ['set', `org.gnome.system.proxy.${protocol}`, 'port', String(port)])
  }

  await run('gsettings', [
    'set',
    'org.gnome.system.proxy',
    'ignore-hosts',
    `[${MAC_BYPASS.map((host) => `'${host}'`).join(', ')}]`,
  ])
  await run('gsettings', ['set', 'org.gnome.system.proxy', 'mode', 'manual'])
}

/**
 * Point the OS proxy settings at the kernel's mixed port, or clear them.
 *
 * Best effort by design: on Linux only the GNOME/GSettings stack is scriptable
 * without extra privileges, and a KDE or bare-WM session simply reports the
 * failure back to the caller instead of silently pretending it worked.
 */
export const setSystemProxy = async (port: number | null): Promise<void> => {
  switch (process.platform) {
    case 'win32':
      await setWindowsProxy(port === null ? null : `127.0.0.1:${port}`)
      return
    case 'darwin':
      await setMacProxy(port)
      return
    case 'linux':
      await setLinuxProxy(port)
      return
    default:
      throw new Error(`system proxy is not supported on ${process.platform}`)
  }
}

/** Whether an OS proxy is currently configured by us (best effort). */
export const isSystemProxyEnabled = async (): Promise<boolean> => {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await run('reg', ['query', INTERNET_SETTINGS, '/v', 'ProxyEnable'])

      return /0x1\b/.test(stdout)
    }

    if (process.platform === 'darwin') {
      const services = await macNetworkServices()

      for (const service of services) {
        const { stdout } = await run('networksetup', ['-getwebproxy', service])

        if (/Enabled:\s*Yes/i.test(stdout)) return true
      }

      return false
    }

    const { stdout } = await run('gsettings', ['get', 'org.gnome.system.proxy', 'mode'])

    return stdout.includes('manual')
  } catch {
    return false
  }
}
