import { readFile, writeFile } from 'node:fs/promises'
import { isMap, parseDocument } from 'yaml'

export type TunStack = 'mixed' | 'gvisor' | 'system'

/**
 * Add or remove mihomo's `tun:` block in a config, leaving everything else
 * byte-for-byte alone (comments included) so a user's hand-written profile
 * survives a TUN toggle.
 */
export const applyTunBlock = (source: string, stack: TunStack | null): string => {
  const doc = parseDocument(source)

  if (!isMap(doc.contents)) doc.contents = parseDocument('{}').contents

  if (stack === null) {
    doc.delete('tun')

    return doc.toString()
  }

  doc.setIn(['tun', 'enable'], true)
  doc.setIn(['tun', 'stack'], stack)
  doc.setIn(['tun', 'auto-route'], true)
  doc.setIn(['tun', 'auto-detect-interface'], true)
  // Without a DNS hijack the OS keeps resolving through its own resolver and
  // the routed traffic never matches the rules the user expects.
  doc.setIn(['tun', 'dns-hijack'], ['any:53'])

  return doc.toString()
}

/** Read the current TUN state straight from the config on disk. */
export const readTunState = async (
  configPath: string,
): Promise<{ enabled: boolean; stack: TunStack }> => {
  try {
    const doc = parseDocument(await readFile(configPath, 'utf8'))
    const enabled = doc.getIn(['tun', 'enable']) === true
    const stack = doc.getIn(['tun', 'stack'])

    return {
      enabled,
      stack: stack === 'gvisor' || stack === 'system' ? stack : 'mixed',
    }
  } catch {
    return { enabled: false, stack: 'mixed' }
  }
}

export const writeTunBlock = async (configPath: string, stack: TunStack | null): Promise<void> => {
  const source = await readFile(configPath, 'utf8')

  await writeFile(configPath, applyTunBlock(source, stack), 'utf8')
}
