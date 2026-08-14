import { readonly, ref } from 'vue'

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

// Snapshots come from the preload bootstrap; these streams keep them current
// for the rest of the session (the tray can change the same settings).
bridge?.kernel.onState((state) => {
  kernelState.value = state
})
bridge?.settings.onChange((settings) => {
  desktopSettings.value = settings
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
