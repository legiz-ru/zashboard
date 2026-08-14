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
  desktopKernelState,
  desktopSettingsState,
  openDesktopPath,
  patchDesktopSettings,
  restartDesktopKernel,
  startDesktopKernel,
  stopDesktopKernel,
} from '@/composables/desktop'
import { version } from '@/assembly/version'
import { computed, ref } from 'vue'

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
</script>
