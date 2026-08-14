import { computed, readonly, ref } from 'vue'

/**
 * Live view of the Electron shell's state.
 *
 * The bridge is injected by the desktop preload script and is simply absent in
 * the browser build, which is what `isDesktop` gates on — every consumer must
 * keep working when it is undefined.
 */
const bridge = typeof window === 'undefined' ? undefined : window.zashboardDesktop

export const isDesktop = Boolean(bridge)

const kernelState = ref<DesktopKernelState | null>(bridge?.initialKernelState ?? null)
const desktopSettings = ref<DesktopSettings | null>(bridge?.initialSettings ?? null)
const profiles = ref<DesktopProfilesSnapshot>(
  bridge?.initialProfiles ?? { profiles: [], activeId: undefined },
)

// Snapshots come from the preload bootstrap; these streams keep them current
// for the rest of the session (the tray can change the same settings).
bridge?.kernel.onState((state) => {
  kernelState.value = state
})
bridge?.settings.onChange((settings) => {
  desktopSettings.value = settings
})
// The shell also mutates profiles on its own (auto-update ticks, clash:// deep
// links), so the list is a stream rather than a fetch-on-open.
bridge?.profiles.onChange((snapshot) => {
  profiles.value = snapshot
})

export const desktopKernelState = readonly(kernelState)
export const desktopSettingsState = readonly(desktopSettings)

/** Version of the mihomo release bundled with this build. */
export const bundledKernelVersion = bridge?.kernelVersion ?? ''
export const desktopAppVersion = bridge?.appVersion ?? ''
export const desktopPaths = bridge?.paths ?? null

export const patchDesktopSettings = async (patch: Partial<DesktopSettings>): Promise<void> => {
  if (!bridge) return
  desktopSettings.value = await bridge.settings.patch(patch)
}

export const restartDesktopKernel = async (): Promise<void> => {
  if (!bridge) return
  kernelState.value = await bridge.kernel.restart()
}

export const startDesktopKernel = async (): Promise<void> => {
  if (!bridge) return
  kernelState.value = await bridge.kernel.start()
}

export const stopDesktopKernel = async (): Promise<void> => {
  if (!bridge) return
  kernelState.value = await bridge.kernel.stop()
}

export const openDesktopPath = (target: 'config' | 'configDir' | 'logs'): void => {
  void bridge?.open(target)
}

export const desktopProfiles = readonly(profiles)

/** True once the user has at least one profile — drives the onboarding gate. */
export const hasDesktopProfile = computed(() => profiles.value.profiles.length > 0)

const applyProfiles = async (
  action: (api: NonNullable<typeof bridge>['profiles']) => Promise<DesktopProfilesSnapshot>,
): Promise<void> => {
  if (!bridge) return
  profiles.value = await action(bridge.profiles)
}

export const importProfileFromUrl = (url: string, name?: string) =>
  applyProfiles((api) => api.importUrl(url, name))

export const importProfileFromText = (name: string, content: string) =>
  applyProfiles((api) => api.importLocal(name, content))

export const refreshProfile = (id: string) => applyProfiles((api) => api.refresh(id))

export const patchProfile = (id: string, patch: { name?: string; updateInterval?: number }) =>
  applyProfiles((api) => api.patch(id, patch))

export const removeProfile = (id: string) => applyProfiles((api) => api.remove(id))

export const activateProfile = (id: string) => applyProfiles((api) => api.activate(id))

// --- kernel versions -------------------------------------------------------

export const listKernelVersions = (source: DesktopKernelSource) =>
  bridge?.kernelSource.versions(source) ?? Promise.resolve([])

export const switchKernelVersion = async (source: DesktopKernelSource, tag: string) => {
  if (!bridge) return
  desktopSettings.value = await bridge.kernelSource.switch(source, tag)
}

export const useBundledKernel = async () => {
  if (!bridge) return
  desktopSettings.value = await bridge.kernelSource.useBundled()
}

/** The config file the kernel is running, injected keys included. */
export const readRuntimeConfig = () => bridge?.runtimeConfig() ?? Promise.resolve('')

// --- TUN -------------------------------------------------------------------

const tun = ref<DesktopTunStatus | null>(null)

bridge?.tun.onChange((status) => {
  tun.value = status
})

export const desktopTun = readonly(tun)

export const refreshTunStatus = async () => {
  if (!bridge) return
  tun.value = await bridge.tun.status()
}

export const enableTun = async (stack: DesktopTunStack) => {
  if (!bridge) return
  tun.value = await bridge.tun.enable(stack)
}

export const disableTun = async () => {
  if (!bridge) return
  tun.value = await bridge.tun.disable()
}

export const uninstallTunHelper = async () => {
  if (!bridge) return
  tun.value = await bridge.tun.uninstallHelper()
}

// --- global hotkeys --------------------------------------------------------

const hotkeys = ref<DesktopHotkeysSnapshot | null>(null)

export const desktopHotkeys = readonly(hotkeys)

export const refreshHotkeys = async () => {
  if (!bridge) return
  hotkeys.value = await bridge.hotkeys.get()
}

export const setHotkeys = async (bindings: Partial<Record<DesktopHotkeyAction, string>>) => {
  if (!bridge) return
  hotkeys.value = await bridge.hotkeys.set(bindings)
}

// --- window controls -------------------------------------------------------

export const desktopWindow = bridge?.window
