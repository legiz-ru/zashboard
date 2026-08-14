import { isMap, parseDocument } from 'yaml'

export type RuntimeConfig = {
  /** `host:port` for mihomo's REST API. */
  externalController: string
  /** API secret; regenerated per install, never empty. */
  secret: string
  /** Fallback mixed port, used only when the config does not define one. */
  defaultMixedPort: number
}

export type AppliedConfig = {
  /** The config text to write back before spawning the kernel. */
  text: string
  /** The mixed (http+socks) port the kernel will actually listen on. */
  mixedPort: number
}

const readPort = (value: unknown): number | null => {
  const port = typeof value === 'string' ? Number.parseInt(value, 10) : value

  return typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536
    ? port
    : null
}

/**
 * Force the API endpoint the desktop shell owns onto a user-editable mihomo
 * config, and report the proxy port the kernel will bind.
 *
 * `external-controller` and `secret` are overwritten on every launch: the shell
 * hands both to the dashboard, so the config must not be able to drift away
 * from them. `mixed-port` is only *filled in* — a user who moved their proxy to
 * a different port keeps it, and the system-proxy toggle follows along.
 *
 * Comments and formatting in the rest of the document are preserved, so this
 * stays non-destructive against a hand-written or imported profile.
 */
export const applyRuntimeConfig = (source: string, runtime: RuntimeConfig): AppliedConfig => {
  const doc = parseDocument(source)

  // An empty (or whitespace-only) config parses to a null document; start a map
  // so the runtime keys below have somewhere to land.
  if (!isMap(doc.contents)) {
    doc.contents = parseDocument('{}').contents
  }

  doc.set('external-controller', runtime.externalController)
  doc.set('secret', runtime.secret)

  // The dashboard is served from a custom app:// origin, so the kernel has to
  // accept cross-origin API calls. Unknown to very old kernels, which ignore it.
  doc.setIn(['external-controller-cors', 'allow-origins'], ['*'])
  doc.setIn(['external-controller-cors', 'allow-private-network'], true)

  const mixedPort = readPort(doc.get('mixed-port')) ?? runtime.defaultMixedPort

  doc.set('mixed-port', mixedPort)

  return { text: doc.toString(), mixedPort }
}
