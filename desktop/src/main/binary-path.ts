import { join } from 'node:path'

export type ResolveBinaryInput = {
  /** process.platform of the running Electron process. */
  platform: NodeJS.Platform
  /** app.isPackaged. */
  isPackaged: boolean
  /** process.resourcesPath — only meaningful in a packaged build. */
  resourcesPath: string
  /** app.getAppPath() — the desktop package root when running unpackaged. */
  appPath: string
  /** User-configured absolute path; when non-empty it always wins. */
  userOverride?: string
}

/**
 * Resolve the mihomo executable. Pure — no fs, no electron imports.
 * - userOverride wins verbatim, so a user can point at their own kernel build
 * - packaged -> `<resourcesPath>/mihomo[.exe]` (electron-builder extraResources)
 * - dev      -> `<appPath>/resources/mihomo[.exe]` (staged by `fetch:mihomo`)
 */
export const resolveKernelBinary = (input: ResolveBinaryInput): string => {
  if (input.userOverride) {
    return input.userOverride
  }

  const exe = input.platform === 'win32' ? 'mihomo.exe' : 'mihomo'

  return input.isPackaged ? join(input.resourcesPath, exe) : join(input.appPath, 'resources', exe)
}

/** Same resolution rules, for the bundled default config. */
export const resolveDefaultConfig = (input: ResolveBinaryInput): string =>
  input.isPackaged
    ? join(input.resourcesPath, 'default-config.yaml')
    : join(input.appPath, 'resources', 'default-config.yaml')
