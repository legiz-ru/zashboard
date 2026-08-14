import { connect } from 'node:net'
import type { HelperRequest, HelperResponse } from '../helper'

/** Per-OS location of the helper's socket and its root-owned secret file. */
export const helperPaths = () => {
  if (process.platform === 'win32') {
    return {
      socketPath: '\\\\.\\pipe\\zashboard-helper',
      secretPath: 'C:\\ProgramData\\zashboard\\helper.secret',
      configPath: 'C:\\ProgramData\\zashboard\\helper.json',
    }
  }

  if (process.platform === 'darwin') {
    return {
      socketPath: '/var/run/zashboard-helper.sock',
      secretPath: '/Library/Application Support/zashboard/helper.secret',
      configPath: '/Library/Application Support/zashboard/helper.json',
    }
  }

  return {
    socketPath: '/run/zashboard-helper.sock',
    secretPath: '/etc/zashboard/helper.secret',
    configPath: '/etc/zashboard/helper.json',
  }
}

/**
 * One request, one connection.
 *
 * The helper is a supervisor, not a hot path — a fresh connection per command
 * keeps the client stateless and means a helper restart never leaves the app
 * holding a dead socket.
 */
export const callHelper = (
  socketPath: string,
  secret: string,
  command: HelperRequest['command'],
  timeoutMs = 10_000,
): Promise<HelperResponse> =>
  new Promise((resolve, reject) => {
    const socket = connect(socketPath)
    let buffer = ''
    const done = (error?: Error, response?: HelperResponse) => {
      clearTimeout(timer)
      socket.destroy()
      if (error) reject(error)
      else if (response) resolve(response)
    }
    const timer = setTimeout(() => done(new Error('the helper did not answer in time')), timeoutMs)

    timer.unref?.()
    socket.setEncoding('utf8')
    socket.on('error', (error) => done(error))
    socket.on('connect', () => {
      socket.write(`${JSON.stringify({ id: Date.now(), secret, command })}\n`)
    })
    socket.on('data', (chunk: string) => {
      buffer += chunk

      const index = buffer.indexOf('\n')

      if (index === -1) return

      try {
        done(undefined, JSON.parse(buffer.slice(0, index)) as HelperResponse)
      } catch {
        done(new Error('the helper sent a malformed response'))
      }
    })
  })

/** Whether an installed helper is reachable and accepts our secret. */
export const helperAvailable = async (socketPath: string, secret: string): Promise<boolean> => {
  try {
    return (await callHelper(socketPath, secret, 'ping', 2_000)).ok
  } catch {
    return false
  }
}
