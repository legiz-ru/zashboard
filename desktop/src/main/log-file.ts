import { appendFileSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAX_BYTES = 2 * 1024 * 1024

/**
 * Append-only log sink with a single rotation step. The dashboard's log view
 * only shows the live session, so this file is what makes yesterday's crash
 * diagnosable; it must never grow without bound and must never throw into the
 * caller's hot path.
 */
export const createLogFile = (dir: string, fileName: string) => {
  const path = join(dir, fileName)

  const rotateIfNeeded = (): void => {
    try {
      if (statSync(path).size < MAX_BYTES) return
      renameSync(path, `${path}.1`)
    } catch {
      // Missing file (nothing to rotate) or a locked rename — either way the
      // next append recreates or keeps using the current file.
    }
  }

  return {
    path,
    write(line: string): void {
      try {
        rotateIfNeeded()
        appendFileSync(path, `${new Date().toISOString()} ${line}\n`, 'utf8')
      } catch {
        // Logging must never break the app.
      }
    },
  }
}
