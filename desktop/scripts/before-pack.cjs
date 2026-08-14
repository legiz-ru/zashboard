// electron-builder beforePack hook.
//
// One invocation packs several architectures from a single host (the Linux and
// Windows legs build x64 AND arm64), and the staged kernel filename carries no
// arch. Without re-staging here, every installer in that run would ship the
// arch that happened to be fetched first.
const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

const PLATFORM = { win32: 'win32', darwin: 'darwin', linux: 'linux' }
// electron-builder's Arch enum ordinals.
const ARCH = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'x64' }

exports.default = async (context) => {
  const os = PLATFORM[context.electronPlatformName] ?? context.electronPlatformName
  const arch = ARCH[context.arch] ?? 'x64'

  if (arch !== 'x64' && arch !== 'arm64') {
    throw new Error(`no mihomo build for ${os}-${arch}`)
  }

  execFileSync(
    process.execPath,
    [join(__dirname, 'fetch-mihomo.mjs'), '--os', os, '--arch', arch, '--force'],
    { stdio: 'inherit', cwd: join(__dirname, '..') },
  )
}
