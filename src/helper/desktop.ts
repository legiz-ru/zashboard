import { activeUuid, backendList } from '@/store/setup'
import type { Backend } from '@/types'
import { v4 as uuid } from 'uuid'

/**
 * Label of the backend entry the desktop shell owns. It is matched by label, so
 * a user who renames it gets a second entry rather than a silently hijacked
 * one — and everything else in their backend list is left alone.
 */
const EMBEDDED_LABEL = 'zashboard desktop'

export const isDesktop = (): boolean => typeof window.zashboardDesktop !== 'undefined'

/**
 * Register (or refresh) the backend entry for the kernel the desktop shell runs,
 * and make it the active one on first launch.
 *
 * The shell picks the API port at startup — the conventional 9090 when it is
 * free, another one when it is not — so the stored entry is rewritten on every
 * launch instead of being trusted. Runs before the app mounts, because the
 * router sends users to the setup page when no backend exists.
 */
export const setupDesktopBackend = (): void => {
  const desktop = window.zashboardDesktop

  if (!desktop) return

  const url = new URL(desktop.endpoint.url)
  const embedded: Omit<Backend, 'uuid'> = {
    type: 'clash',
    protocol: url.protocol.replace(':', ''),
    host: url.hostname,
    port: url.port,
    secondaryPath: '',
    password: desktop.endpoint.secret,
    label: EMBEDDED_LABEL,
    // The kernel binary is owned by the shell's supervisor: letting the kernel
    // replace and restart itself mid-flight would leave the supervisor tracking
    // a process that no longer exists.
    disableUpgradeCore: true,
  }

  const existing = backendList.value.find((backend) => backend.label === EMBEDDED_LABEL)

  if (existing) {
    Object.assign(existing, embedded)
    if (!activeUuid.value) activeUuid.value = existing.uuid

    return
  }

  const id = uuid()

  backendList.value.push({ ...embedded, uuid: id })
  activeUuid.value = id
}
