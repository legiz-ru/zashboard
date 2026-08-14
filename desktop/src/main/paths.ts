import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type DataPaths = {
  /** mihomo's working directory (`-d`): config, cache.db, geo databases. */
  homeDir: string
  /** The active config mihomo is launched with (`-f`). */
  configPath: string
  /** Kernel + app logs. */
  logsDir: string
  /** Desktop-shell settings (tray/system-proxy/kernel override). */
  settingsPath: string
}

/** Pure: derive the on-disk layout under an Electron userData root. */
export const dataPaths = (userData: string): DataPaths => {
  const homeDir = join(userData, 'mihomo-home')

  return {
    homeDir,
    configPath: join(homeDir, 'config.yaml'),
    logsDir: join(userData, 'logs'),
    settingsPath: join(userData, 'desktop-settings.json'),
  }
}

/**
 * Create the directory layout and, on first run only, seed the active config
 * with `defaultConfig`. Idempotent — a config the user has since edited (or one
 * the dashboard imported) is never overwritten.
 */
export const bootstrapDataDir = (
  userData: string,
  defaultConfig: string,
): DataPaths & { seededConfig: boolean } => {
  const paths = dataPaths(userData)

  mkdirSync(paths.homeDir, { recursive: true })
  mkdirSync(paths.logsDir, { recursive: true })

  if (existsSync(paths.configPath)) {
    return { ...paths, seededConfig: false }
  }

  writeFileSync(paths.configPath, defaultConfig, 'utf8')

  return { ...paths, seededConfig: true }
}
