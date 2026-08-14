import { execFile } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { gunzipSync } from 'node:zlib'
import type { KernelSource, KernelVersion } from '../shared/ipc'

const run = promisify(execFile)

/**
 * Where kernels come from.
 *
 * `mihomo` is the upstream project: one release per version tag, with asset
 * names derivable from the tag. `smart` is vernesong's fork carrying the Smart
 * outbound group; it publishes a single rolling `Prerelease-Alpha` release
 * whose asset names embed the build's commit sha, so its asset has to be looked
 * up in the release rather than constructed.
 */
export const KERNEL_SOURCES: Record<KernelSource, { repo: string; rollingTag?: string }> = {
  mihomo: { repo: 'MetaCubeX/mihomo' },
  smart: { repo: 'vernesong/mihomo', rollingTag: 'Prerelease-Alpha' },
}

const OS_MAP: Record<string, 'linux' | 'darwin' | 'windows'> = {
  linux: 'linux',
  darwin: 'darwin',
  win32: 'windows',
}

const ARCH_MAP: Record<string, 'amd64' | 'arm64'> = { x64: 'amd64', arm64: 'arm64' }

type GithubAsset = { name?: string; browser_download_url?: string }
type GithubRelease = { tag_name?: string; assets?: GithubAsset[]; published_at?: string }

const api = async <T>(url: string, githubToken?: string): Promise<T> => {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'zashboard-desktop',
  }

  if (githubToken) headers.Authorization = `Bearer ${githubToken}`

  const response = await fetch(url, { headers })

  if (!response.ok) throw new Error(`GitHub API returned ${response.status} for ${url}`)

  return (await response.json()) as T
}

const isVersionTag = (tag: string): boolean => /^v\d+(\.\d+)+/.test(tag)

/** Compare `vX.Y.Z` tags numerically, newest first. */
const compareTagsDesc = (a: string, b: string): number => {
  const parse = (tag: string) => tag.replace(/^v/, '').split(/[.-]/).map(Number)
  const left = parse(a)
  const right = parse(b)

  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const x = left[index] ?? 0
    const y = right[index] ?? 0

    if (Number.isNaN(x) || Number.isNaN(y)) continue
    if (x !== y) return y - x
  }

  return b.localeCompare(a)
}

export const listKernelVersions = async (
  source: KernelSource,
  deps: { githubToken?: string } = {},
): Promise<KernelVersion[]> => {
  const { repo, rollingTag } = KERNEL_SOURCES[source]

  if (rollingTag) {
    // A rolling release has exactly one "version"; the build sha inside its
    // asset names is what actually changes, so surface that as the label.
    const release = await api<GithubRelease>(
      `https://api.github.com/repos/${repo}/releases/tags/${rollingTag}`,
      deps.githubToken,
    )
    const sha = release.assets
      ?.map((asset) => /-alpha-smart-([0-9a-f]{6,})\./.exec(asset.name ?? '')?.[1])
      .find(Boolean)

    return [{ tag: rollingTag, label: sha ? `${rollingTag} (${sha})` : rollingTag }]
  }

  const releases = await api<GithubRelease[]>(
    `https://api.github.com/repos/${repo}/releases?per_page=30`,
    deps.githubToken,
  )

  return releases
    .map((release) => release.tag_name)
    .filter((tag): tag is string => typeof tag === 'string' && isVersionTag(tag))
    .sort(compareTagsDesc)
    .map((tag) => ({ tag, label: tag }))
}

type ResolvedAsset = { url: string; name: string; ext: 'gz' | 'zip' }

/**
 * Pick the asset to download for this machine.
 *
 * amd64 gets the `-compatible` build wherever one exists: it drops the v3
 * microarchitecture requirement that older CPUs and some VMs do not meet. The
 * fork also publishes `-vN` and `-goNNN` variants — those are deliberately
 * skipped in favour of the plain build.
 */
export const resolveKernelAsset = async (
  source: KernelSource,
  version: string,
  platform: string,
  arch: string,
  deps: { githubToken?: string } = {},
): Promise<ResolvedAsset> => {
  const os = OS_MAP[platform]
  const cpu = ARCH_MAP[arch]

  if (!os || !cpu) throw new Error(`unsupported target: ${platform}-${arch}`)

  const { repo, rollingTag } = KERNEL_SOURCES[source]
  const ext = os === 'windows' ? 'zip' : 'gz'

  if (!rollingTag) {
    const variant = cpu === 'amd64' ? '-compatible' : ''
    const name = `mihomo-${os}-${cpu}${variant}-${version}.${ext}`

    return {
      name,
      ext,
      url: `https://github.com/${repo}/releases/download/${version}/${name}`,
    }
  }

  const release = await api<GithubRelease>(
    `https://api.github.com/repos/${repo}/releases/tags/${rollingTag}`,
    deps.githubToken,
  )
  const candidates = (release.assets ?? []).filter(
    (asset): asset is Required<GithubAsset> =>
      typeof asset.name === 'string' && typeof asset.browser_download_url === 'string',
  )
  // `-compatible` first, then the plain build; anything carrying a -vN / -goNNN
  // marker is a narrower build we do not want to hand a user by default.
  const patterns = [
    new RegExp(`^mihomo-${os}-${cpu}-compatible-alpha-smart-[0-9a-f]+\\.${ext}$`),
    new RegExp(`^mihomo-${os}-${cpu}-alpha-smart-[0-9a-f]+\\.${ext}$`),
  ]

  for (const pattern of patterns) {
    const match = candidates.find((asset) => pattern.test(asset.name))

    if (match) return { name: match.name, ext, url: match.browser_download_url }
  }

  throw new Error(`no ${os}-${cpu} asset in ${repo}@${rollingTag}`)
}

/** Extract one entry from a .zip using bsdtar (`tar`), falling back to unzip. */
const extractZipEntry = async (buffer: Buffer): Promise<Buffer> => {
  const dir = mkdtempSync(join(tmpdir(), 'zashboard-kernel-'))
  const archive = join(dir, 'archive.zip')

  try {
    writeFileSync(archive, buffer)

    try {
      await run('tar', ['-xf', archive, '-C', dir])
    } catch {
      await run('unzip', ['-o', archive, '-d', dir])
    }

    const { readdirSync } = await import('node:fs')
    const entry = readdirSync(dir).find((file) => file.endsWith('.exe'))

    if (!entry) throw new Error('no executable inside the downloaded archive')

    return readFileSync(join(dir, entry))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Download a kernel into `destDir` and return the executable's path. Each
 * version lands in its own directory so switching back to a previously used
 * kernel is a path change rather than another download.
 */
export const downloadKernel = async (
  source: KernelSource,
  version: string,
  destDir: string,
  platform: string,
  arch: string,
  deps: { githubToken?: string } = {},
): Promise<string> => {
  const asset = await resolveKernelAsset(source, version, platform, arch, deps)
  const response = await fetch(asset.url, { redirect: 'follow' })

  if (!response.ok) throw new Error(`kernel download failed with ${response.status}`)

  const downloaded = Buffer.from(await response.arrayBuffer())
  // The .gz asset is a raw single-file binary, never a tarball.
  const binary = asset.ext === 'gz' ? gunzipSync(downloaded) : await extractZipEntry(downloaded)

  mkdirSync(destDir, { recursive: true })

  const binPath = join(destDir, platform === 'win32' ? 'mihomo.exe' : 'mihomo')

  writeFileSync(binPath, binary)
  if (platform !== 'win32') chmodSync(binPath, 0o755)

  return binPath
}
