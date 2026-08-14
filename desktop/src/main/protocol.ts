import { net, protocol } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Scheme + host the packaged dashboard is served from. */
export const APP_SCHEME = 'zashboard'
export const APP_ORIGIN = `${APP_SCHEME}://app`
export const APP_INDEX = `${APP_ORIGIN}/index.html`

/**
 * Must run before `app.whenReady()`.
 *
 * The dashboard is served from a custom scheme rather than `file://` so it gets
 * a *stable, secure* origin: localStorage/IndexedDB (where zashboard keeps its
 * backends and settings) survive across launches and app updates, and the
 * loopback kernel API stays reachable — Chromium treats 127.0.0.1 as
 * trustworthy, so calling it from a secure origin is not mixed content.
 */
export const registerAppScheme = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

/** Must run after `app.whenReady()`. Serves `rendererDir` over APP_SCHEME. */
export const serveRenderer = (rendererDir: string): void => {
  const root = resolve(rendererDir)

  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url)
    const requested = resolve(join(root, decodeURIComponent(pathname)))
    const inside = !relative(root, requested).startsWith('..')
    const isFile = inside && existsSync(requested) && statSync(requested).isFile()
    // Unknown paths fall back to index.html. zashboard routes on the hash, so
    // this only ever catches a stray deep link, never a real asset.
    const target = isFile ? requested : join(root, 'index.html')

    return net.fetch(pathToFileURL(target).toString())
  })
}
