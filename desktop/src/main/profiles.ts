import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { copyFile, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProfileMeta, SubscriptionInfo } from '../shared/ipc'

/** UA that subscription providers recognise as a mihomo/clash client. */
const USER_AGENT = 'clash.meta'
/** Guard against a provider handing back an HTML error page or a huge blob. */
const MAX_PROFILE_BYTES = 16 * 1024 * 1024

export type ProfileStoreOptions = {
  /** Directory holding profiles.json and the per-profile YAML files. */
  dir: string
  /** The config mihomo is launched with; activating a profile writes here. */
  activeConfigPath: string
  /** Validate a candidate config before it becomes active (`mihomo -t`). */
  validate: (configPath: string) => Promise<{ valid: boolean; message: string }>
  /** Called after the active config changed, to bring the kernel onto it. */
  applied: () => Promise<void>
}

type StoredState = {
  profiles: ProfileMeta[]
  activeId?: string
}

/**
 * Parse the `subscription-userinfo` header providers send with a subscription,
 * e.g. `upload=0; download=123; total=456; expire=1700000000`.
 */
export const parseSubscriptionInfo = (header: string | null): SubscriptionInfo | undefined => {
  if (!header) return undefined

  const fields: Record<string, number> = {}

  for (const part of header.split(';')) {
    const [key, value] = part.split('=').map((piece) => piece.trim())
    const parsed = Number(value)

    if (key && Number.isFinite(parsed)) fields[key.toLowerCase()] = parsed
  }

  if (Object.keys(fields).length === 0) return undefined

  return {
    upload: fields.upload ?? 0,
    download: fields.download ?? 0,
    total: fields.total ?? 0,
    // Providers send seconds; 0 means "no expiry".
    expire: fields.expire ?? 0,
  }
}

/** Derive a readable name from a subscription URL when the user gave none. */
const nameFromUrl = (url: string): string => {
  try {
    const { hostname, searchParams } = new URL(url)

    return searchParams.get('name') || hostname || 'subscription'
  } catch {
    return 'subscription'
  }
}

/**
 * Profiles are the desktop app's answer to "where does my config come from":
 * a list of local or subscription-backed mihomo configs, exactly one of which
 * is active. Activating one validates it with the kernel first and keeps a
 * backup, so a broken subscription cannot leave the app without a working
 * config.
 */
export class ProfileStore {
  private state: StoredState = { profiles: [] }
  private timers = new Map<string, NodeJS.Timeout>()

  constructor(private readonly options: ProfileStoreOptions) {
    mkdirSync(options.dir, { recursive: true })
    this.state = this.read()
  }

  list(): ProfileMeta[] {
    return this.state.profiles.map((profile) => ({ ...profile }))
  }

  activeId(): string | undefined {
    return this.state.activeId
  }

  /** Raw YAML of a profile, for the editor / for inspection. */
  async content(id: string): Promise<string> {
    return readFile(this.pathOf(id), 'utf8')
  }

  async importFromUrl(url: string, name?: string): Promise<ProfileMeta> {
    const { content, subscriptionInfo } = await this.download(url)
    const profile: ProfileMeta = {
      id: randomUUID(),
      name: name?.trim() || nameFromUrl(url),
      type: 'remote',
      url,
      // 24h by default: often enough for node changes, rare enough not to hammer
      // the provider. 0 turns auto-update off.
      updateInterval: 1440,
      updatedAt: Date.now(),
      subscriptionInfo,
    }

    await writeFile(this.pathOf(profile.id), content, 'utf8')
    this.state.profiles.push(profile)
    this.persist()
    this.schedule(profile)

    return { ...profile }
  }

  /** Create a profile from pasted text or an imported file. */
  async importLocal(name: string, content: string): Promise<ProfileMeta> {
    const profile: ProfileMeta = {
      id: randomUUID(),
      name: name.trim() || 'local',
      type: 'local',
      updatedAt: Date.now(),
    }

    await writeFile(this.pathOf(profile.id), content, 'utf8')
    this.state.profiles.push(profile)
    this.persist()

    return { ...profile }
  }

  /** Re-download a remote profile in place, keeping its id and settings. */
  async refresh(id: string): Promise<ProfileMeta> {
    const profile = this.require(id)

    if (profile.type !== 'remote' || !profile.url) {
      throw new Error('only subscription profiles can be refreshed')
    }

    const { content, subscriptionInfo } = await this.download(profile.url)

    await writeFile(this.pathOf(id), content, 'utf8')
    profile.updatedAt = Date.now()
    profile.subscriptionInfo = subscriptionInfo
    this.persist()

    // Keep the running kernel on the freshly downloaded nodes.
    if (this.state.activeId === id) await this.setActive(id)

    return { ...profile }
  }

  async patch(
    id: string,
    patch: { name?: string; updateInterval?: number; content?: string },
  ): Promise<ProfileMeta> {
    const profile = this.require(id)

    if (patch.name !== undefined) profile.name = patch.name.trim() || profile.name
    if (patch.updateInterval !== undefined) {
      profile.updateInterval = Math.max(0, Math.floor(patch.updateInterval))
    }
    if (patch.content !== undefined) {
      await writeFile(this.pathOf(id), patch.content, 'utf8')
      profile.updatedAt = Date.now()
    }

    this.persist()
    this.schedule(profile)

    if (patch.content !== undefined && this.state.activeId === id) await this.setActive(id)

    return { ...profile }
  }

  async remove(id: string): Promise<void> {
    this.require(id)
    this.clearTimer(id)
    await rm(this.pathOf(id), { force: true })
    this.state.profiles = this.state.profiles.filter((profile) => profile.id !== id)
    if (this.state.activeId === id) this.state.activeId = undefined
    this.persist()
  }

  /**
   * Make a profile the active config: validate it with the kernel, back up the
   * config currently in place, write the new one, then let the caller restart
   * the kernel. A profile that fails validation is rejected before anything on
   * disk changes, so the running setup survives a bad subscription.
   */
  async setActive(id: string): Promise<ProfileMeta> {
    const profile = this.require(id)
    const source = this.pathOf(id)
    const { valid, message } = await this.options.validate(source)

    if (!valid) throw new Error(message || 'the kernel rejected this profile')

    if (existsSync(this.options.activeConfigPath)) {
      await copyFile(this.options.activeConfigPath, `${this.options.activeConfigPath}.bak`)
    }

    await copyFile(source, this.options.activeConfigPath)
    this.state.activeId = id
    this.persist()
    await this.options.applied()

    return { ...profile }
  }

  /** Start auto-update timers for every remote profile. */
  startScheduler(): void {
    for (const profile of this.state.profiles) this.schedule(profile)
  }

  stopScheduler(): void {
    for (const id of [...this.timers.keys()]) this.clearTimer(id)
  }

  private async download(url: string): Promise<{
    content: string
    subscriptionInfo?: SubscriptionInfo
  }> {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error(`subscription request failed with ${response.status}`)
    }

    const content = await response.text()

    if (content.length > MAX_PROFILE_BYTES) {
      throw new Error('the subscription response is too large to be a config')
    }
    if (content.trim().length === 0) {
      throw new Error('the subscription response is empty')
    }

    return {
      content,
      subscriptionInfo: parseSubscriptionInfo(response.headers.get('subscription-userinfo')),
    }
  }

  private schedule(profile: ProfileMeta): void {
    this.clearTimer(profile.id)

    if (profile.type !== 'remote' || !profile.updateInterval) return

    const timer = setInterval(() => {
      void this.refresh(profile.id).catch(() => {
        // A failed auto-update keeps the previous content; the next tick retries.
      })
    }, profile.updateInterval * 60_000)

    timer.unref?.()
    this.timers.set(profile.id, timer)
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id)

    if (timer) clearInterval(timer)
    this.timers.delete(id)
  }

  private require(id: string): ProfileMeta {
    const profile = this.state.profiles.find((item) => item.id === id)

    if (!profile) throw new Error(`unknown profile: ${id}`)

    return profile
  }

  private pathOf(id: string): string {
    return join(this.options.dir, `${id}.yaml`)
  }

  private read(): StoredState {
    try {
      const raw = JSON.parse(readFileSync(join(this.options.dir, 'profiles.json'), 'utf8'))
      const profiles = Array.isArray(raw?.profiles) ? (raw.profiles as ProfileMeta[]) : []

      return {
        profiles: profiles.filter((profile) => typeof profile?.id === 'string'),
        activeId: typeof raw?.activeId === 'string' ? raw.activeId : undefined,
      }
    } catch {
      return { profiles: [] }
    }
  }

  private persist(): void {
    try {
      writeFileSync(
        join(this.options.dir, 'profiles.json'),
        `${JSON.stringify(this.state, null, 2)}\n`,
        'utf8',
      )
    } catch {
      // Keep the in-memory list usable for this session.
    }
  }
}
