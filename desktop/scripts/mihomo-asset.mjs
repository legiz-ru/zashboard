// Where the bundled kernel comes from. Bump MIHOMO_VERSION to ship a newer one
// (or override it in the environment for a one-off build).
export const MIHOMO_VERSION = process.env.MIHOMO_VERSION ?? 'v1.19.29'

const OS_MAP = {
  linux: 'linux',
  darwin: 'darwin',
  win32: 'windows',
  windows: 'windows',
}

const ARCH_MAP = {
  x64: 'amd64',
  amd64: 'amd64',
  arm64: 'arm64',
}

/**
 * Resolve the mihomo release asset for an os/arch pair.
 *
 * amd64 gets the `-compatible` build: it drops the v3 microarchitecture
 * requirement, which older CPUs (and some VMs) do not satisfy.
 */
export const mihomoAsset = (os, arch, version = MIHOMO_VERSION) => {
  const target = OS_MAP[os]
  const cpu = ARCH_MAP[arch]

  if (!target) throw new Error(`unsupported os: ${os}`)
  if (!cpu) throw new Error(`unsupported arch: ${arch}`)

  const ext = target === 'windows' ? 'zip' : 'gz'
  const variant = cpu === 'amd64' ? '-compatible' : ''
  const name = `mihomo-${target}-${cpu}${variant}-${version}.${ext}`

  return {
    name,
    url: `https://github.com/MetaCubeX/mihomo/releases/download/${version}/${name}`,
    ext,
    binName: target === 'windows' ? 'mihomo.exe' : 'mihomo',
    // The entry inside the Windows .zip is the UN-versioned full name, which
    // differs from the binName we stage it as.
    zipEntry: ext === 'zip' ? `mihomo-${target}-${cpu}${variant}.exe` : undefined,
  }
}
