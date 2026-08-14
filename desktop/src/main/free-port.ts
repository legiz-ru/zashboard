import { createServer } from 'node:net'

const canBind = (port: number, host: string): Promise<boolean> =>
  new Promise((resolve) => {
    const server = createServer()

    server.unref()
    server.once('error', () => resolve(false))
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolve(true))
    })
  })

/**
 * Pick a loopback port for the kernel's REST API / mixed proxy.
 *
 * The preferred port is tried first and reused across launches whenever it is
 * free, which keeps a user's `http://127.0.0.1:9090` bookmarks, browser proxy
 * settings and firewall rules stable. Only when it is taken do we walk forward
 * a bounded range, falling back to an ephemeral port as a last resort.
 */
export const findFreePort = async (preferred: number, attempts = 20): Promise<number> => {
  for (let offset = 0; offset < attempts; offset++) {
    const port = preferred + offset

    if (port > 65535) break
    if (await canBind(port, '127.0.0.1')) return port
  }

  return new Promise((resolve, reject) => {
    const server = createServer()

    server.once('error', reject)
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      const address = server.address()

      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('failed to allocate an ephemeral port')))
        return
      }

      const { port } = address

      server.close(() => resolve(port))
    })
  })
}
