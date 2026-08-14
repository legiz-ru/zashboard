<template>
  <div
    v-if="hasVisibleItems"
    class="flex flex-col gap-3 text-sm"
  >
    <div class="settings-grid">
      <!-- 内核管理 -->
      <SettingItem
        :setting-key="k.kernelControl"
        class="p-4"
      >
        <div class="flex w-full flex-col gap-3">
          <div class="flex items-center gap-2">
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="statusColor"
            ></span>
            <span class="font-medium">{{ $t(statusLabel) }}</span>
            <span
              v-if="kernel?.elevated"
              class="badge badge-sm badge-warning"
            >
              {{ $t('elevated') }}
            </span>
          </div>
          <div
            v-if="kernel?.error"
            class="text-error break-all"
          >
            {{ kernel.error }}
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              class="btn btn-sm"
              :disabled="busy"
              @click="handlerRestart"
            >
              <span
                v-if="busy"
                class="loading loading-spinner h-4 w-4"
              ></span>
              {{ $t('restartCore') }}
            </button>
            <button
              v-if="kernel?.status === 'running'"
              class="btn btn-sm"
              :disabled="busy"
              @click="run(stopDesktopKernel)"
            >
              {{ $t('stopCore') }}
            </button>
            <button
              v-else
              class="btn btn-sm"
              :disabled="busy"
              @click="run(startDesktopKernel)"
            >
              {{ $t('startCore') }}
            </button>
          </div>
        </div>
      </SettingItem>

      <!-- 提权启动内核（TUN 模式所需） -->
      <SettingItem :setting-key="k.elevateKernel">
        <div class="flex flex-col">
          <div class="setting-item-label">
            {{ $t('elevateKernel') }}
          </div>
          <div class="text-base-content/60 text-xs">
            {{ $t('elevateKernelDesc') }}
          </div>
        </div>
        <input
          class="toggle"
          type="checkbox"
          :checked="settings?.elevateKernel"
          @change="handlerElevateChange"
        />
      </SettingItem>

      <!-- 内核版本 -->
      <SettingItem :setting-key="k.kernelVersion">
        <div class="setting-item-label">
          {{ $t('kernelVersion') }}
        </div>
        <div class="flex flex-col items-end text-xs">
          <span>{{ version || '-' }}</span>
          <span
            v-if="bundledKernelVersion"
            class="text-base-content/60"
          >
            {{ $t('bundledKernel', { version: bundledKernelVersion }) }}
          </span>
        </div>
      </SettingItem>

      <!-- 内核来源与版本切换 -->
      <SettingItem
        :setting-key="k.kernelManager"
        class="p-4"
      >
        <div class="flex w-full flex-col gap-2">
          <div class="setting-item-label">{{ $t('kernelManager') }}</div>
          <div class="text-base-content/60 text-xs">{{ $t('kernelManagerDesc') }}</div>
          <div class="flex flex-wrap items-center gap-2">
            <select
              v-model="kernelSource"
              class="select select-xs w-40"
              @change="loadVersions"
            >
              <option value="mihomo">{{ $t('kernelSourceMihomo') }}</option>
              <option value="smart">{{ $t('kernelSourceSmart') }}</option>
            </select>
            <select
              v-model="kernelTag"
              class="select select-xs w-56"
              :disabled="!versions.length"
            >
              <option
                v-for="item in versions"
                :key="item.tag"
                :value="item.tag"
              >
                {{ item.label }}
              </option>
            </select>
            <button
              class="btn btn-xs"
              :disabled="kernelBusy"
              @click="loadVersions"
            >
              {{ $t('refreshList') }}
            </button>
            <button
              class="btn btn-primary btn-xs"
              :disabled="kernelBusy || !kernelTag"
              @click="handlerSwitchKernel"
            >
              <span
                v-if="kernelBusy"
                class="loading loading-spinner h-3 w-3"
              ></span>
              {{ $t('install') }}
            </button>
            <button
              v-if="settings?.kernelPath"
              class="btn btn-xs"
              :disabled="kernelBusy"
              @click="run(useBundledKernel)"
            >
              {{ $t('useBundledKernel') }}
            </button>
          </div>
          <div
            v-if="settings?.kernelSource"
            class="text-base-content/60 text-xs"
          >
            {{
              $t('currentKernel', {
                source: settings.kernelSource,
                version: settings.kernelVersion,
              })
            }}
          </div>
          <div
            v-if="kernelError"
            class="text-error text-xs break-all"
          >
            {{ kernelError }}
          </div>
        </div>
      </SettingItem>

      <!-- TUN(需要特权助手) -->
      <SettingItem
        :setting-key="k.tunMode"
        class="p-4"
      >
        <div class="flex w-full flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-col">
              <div class="setting-item-label">{{ $t('tunMode') }}</div>
              <div class="text-base-content/60 text-xs">{{ $t('tunModeDesc') }}</div>
            </div>
            <input
              class="toggle"
              type="checkbox"
              :checked="tun?.enabled"
              :disabled="tunBusy || !tun?.supported"
              @change="handlerTun"
            />
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span>{{ $t('tunStack') }}</span>
            <select
              v-model="tunStack"
              class="select select-xs w-32"
              :disabled="tunBusy"
            >
              <option value="mixed">mixed</option>
              <option value="gvisor">gvisor</option>
              <option value="system">system</option>
            </select>
            <button
              v-if="tun?.helperInstalled"
              class="btn btn-xs btn-outline btn-error"
              :disabled="tunBusy"
              @click="run(uninstallTunHelper)"
            >
              {{ $t('uninstallHelper') }}
            </button>
          </div>
          <div
            v-if="!tun?.supported"
            class="text-base-content/60 text-xs"
          >
            {{ $t('tunUnsupported') }}
          </div>
          <div
            v-if="tun?.error"
            class="text-error text-xs break-all"
          >
            {{ tun.error }}
          </div>
        </div>
      </SettingItem>

      <!-- 全局快捷键 -->
      <SettingItem
        :setting-key="k.hotkeys"
        class="p-4"
      >
        <div class="flex w-full flex-col gap-2">
          <div class="setting-item-label">{{ $t('globalHotkeys') }}</div>
          <div class="text-base-content/60 text-xs">{{ $t('globalHotkeysDesc') }}</div>
          <div
            v-for="action in HOTKEY_ACTIONS"
            :key="action"
            class="flex items-center gap-2 text-xs"
          >
            <span class="w-40 shrink-0">{{ $t(`hotkey_${action}`) }}</span>
            <input
              class="input input-xs flex-1"
              :value="hotkeys?.bindings[action] ?? ''"
              placeholder="CommandOrControl+Shift+X"
              @change="handlerHotkey(action, $event)"
            />
            <span
              v-if="hotkeyFailed(action)"
              class="text-error"
            >
              {{ $t('hotkeyTaken') }}
            </span>
          </div>
        </div>
      </SettingItem>

      <SettingItem :setting-key="k.systemProxy">
        <div class="flex flex-col">
          <div class="setting-item-label">
            {{ $t('systemProxy') }}
          </div>
          <div class="text-base-content/60 text-xs">
            {{ $t('systemProxyDesc', { port: kernel?.mixedPort ?? '-' }) }}
          </div>
        </div>
        <input
          class="toggle"
          type="checkbox"
          :checked="settings?.systemProxy"
          @change="handlerToggle('systemProxy', $event)"
        />
      </SettingItem>

      <SettingItem :setting-key="k.launchAtLogin">
        <div class="setting-item-label">
          {{ $t('launchAtLogin') }}
        </div>
        <input
          class="toggle"
          type="checkbox"
          :checked="settings?.launchAtLogin"
          @change="handlerToggle('launchAtLogin', $event)"
        />
      </SettingItem>

      <SettingItem :setting-key="k.minimizeToTray">
        <div class="setting-item-label">
          {{ $t('minimizeToTray') }}
        </div>
        <input
          class="toggle"
          type="checkbox"
          :checked="settings?.minimizeToTray"
          @change="handlerToggle('minimizeToTray', $event)"
        />
      </SettingItem>

      <SettingItem
        :setting-key="k.openFolders"
        class="p-4"
      >
        <div class="flex w-full flex-wrap gap-2">
          <button
            class="btn btn-sm"
            @click="openDesktopPath('configDir')"
          >
            {{ $t('openConfigFolder') }}
          </button>
          <button
            class="btn btn-sm"
            @click="openDesktopPath('logs')"
          >
            {{ $t('openLogsFolder') }}
          </button>
        </div>
      </SettingItem>
    </div>
  </div>
</template>

<script setup lang="ts">
import SettingItem from '@/components/settings/SettingItem.vue'
import { useHasAnyVisibleSetting } from '@/composables/settings'
import { DESKTOP_ITEM_KEYS as k, getItemKeysByCategory } from '@/config/settingsItems'
import { SETTINGS_MENU_KEY } from '@/constant'
import {
  bundledKernelVersion,
  desktopHotkeys,
  desktopKernelState,
  desktopSettingsState,
  desktopTun,
  disableTun,
  enableTun,
  listKernelVersions,
  openDesktopPath,
  patchDesktopSettings,
  refreshHotkeys,
  refreshTunStatus,
  restartDesktopKernel,
  setHotkeys,
  startDesktopKernel,
  stopDesktopKernel,
  switchKernelVersion,
  uninstallTunHelper,
  useBundledKernel,
} from '@/composables/desktop'
import { version } from '@/assembly/version'
import { computed, onMounted, ref, watch } from 'vue'

const STATUS_LABEL: Record<DesktopKernelStatus, string> = {
  stopped: 'kernelStopped',
  starting: 'kernelStarting',
  running: 'kernelRunning',
  errored: 'kernelErrored',
}

const STATUS_COLOR: Record<DesktopKernelStatus, string> = {
  stopped: 'bg-base-content/30',
  starting: 'bg-warning',
  running: 'bg-success',
  errored: 'bg-error',
}

const hasVisibleItems = useHasAnyVisibleSetting(getItemKeysByCategory(SETTINGS_MENU_KEY.desktop))

const kernel = desktopKernelState
const settings = desktopSettingsState
const busy = ref(false)

const statusLabel = computed(() => STATUS_LABEL[kernel.value?.status ?? 'stopped'])
const statusColor = computed(() => STATUS_COLOR[kernel.value?.status ?? 'stopped'])

const run = async (action: () => Promise<void>) => {
  if (busy.value) return
  busy.value = true
  try {
    await action()
  } finally {
    busy.value = false
  }
}

const handlerRestart = () => run(restartDesktopKernel)

const handlerToggle = (key: keyof DesktopSettings, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked

  void patchDesktopSettings({ [key]: checked })
}

// 提权只在内核启动时生效，所以改完开关立即重启内核，用户不用再手动重启应用。
const handlerElevateChange = async (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked

  await patchDesktopSettings({ elevateKernel: checked })
  await run(restartDesktopKernel)
}

// --- 内核版本管理 ---

const kernelSource = ref<DesktopKernelSource>('mihomo')
const kernelTag = ref('')
const versions = ref<DesktopKernelVersion[]>([])
const kernelBusy = ref(false)
const kernelError = ref('')

const loadVersions = async () => {
  kernelBusy.value = true
  kernelError.value = ''
  try {
    versions.value = await listKernelVersions(kernelSource.value)
    kernelTag.value = versions.value[0]?.tag ?? ''
  } catch (error) {
    versions.value = []
    kernelError.value = error instanceof Error ? error.message : String(error)
  } finally {
    kernelBusy.value = false
  }
}

const handlerSwitchKernel = async () => {
  kernelBusy.value = true
  kernelError.value = ''
  try {
    await switchKernelVersion(kernelSource.value, kernelTag.value)
  } catch (error) {
    kernelError.value = error instanceof Error ? error.message : String(error)
  } finally {
    kernelBusy.value = false
  }
}

// --- TUN ---

const tun = desktopTun
const tunStack = ref<DesktopTunStack>('mixed')
const tunBusy = ref(false)

watch(tun, (status) => {
  if (status) tunStack.value = status.stack
})

const handlerTun = async (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked

  tunBusy.value = true
  try {
    if (checked) await enableTun(tunStack.value)
    else await disableTun()
  } finally {
    tunBusy.value = false
  }
}

// --- 全局快捷键 ---

const HOTKEY_ACTIONS: DesktopHotkeyAction[] = [
  'toggleWindow',
  'toggleSystemProxy',
  'restartKernel',
  'modeRule',
  'modeGlobal',
  'modeDirect',
]

const hotkeys = desktopHotkeys
const hotkeyFailed = (action: DesktopHotkeyAction) =>
  hotkeys.value?.failed.some((entry) => entry.action === action) ?? false

const handlerHotkey = (action: DesktopHotkeyAction, event: Event) => {
  const accelerator = (event.target as HTMLInputElement).value.trim()

  void setHotkeys({ [action]: accelerator })
}

onMounted(() => {
  void refreshTunStatus()
  void refreshHotkeys()
})
</script>
