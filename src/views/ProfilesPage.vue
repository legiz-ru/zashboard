<template>
  <div
    class="h-full overflow-y-auto"
    :style="padding"
  >
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-4 p-3 md:px-8 md:py-6">
      <!-- 导入区 -->
      <div class="card bg-base-100 gap-3 p-4">
        <div class="text-lg font-semibold">{{ $t('importProfile') }}</div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            v-model="importUrl"
            class="input input-sm flex-1"
            :placeholder="$t('subscriptionUrlPlaceholder')"
            @keyup.enter="handlerImportUrl"
          />
          <div class="flex gap-2">
            <button
              class="btn btn-primary btn-sm"
              :disabled="busy || !importUrl.trim()"
              @click="handlerImportUrl"
            >
              <span
                v-if="busy"
                class="loading loading-spinner h-4 w-4"
              ></span>
              {{ $t('import') }}
            </button>
            <button
              class="btn btn-sm"
              :disabled="busy"
              @click="fileInput?.click()"
            >
              {{ $t('importFromFile') }}
            </button>
          </div>
        </div>
        <div
          v-if="error"
          class="text-error text-xs break-all whitespace-pre-wrap"
        >
          {{ error }}
        </div>
        <input
          ref="fileInput"
          type="file"
          accept=".yaml,.yml,.txt"
          class="hidden"
          @change="handlerImportFile"
        />
      </div>

      <!-- 配置列表 -->
      <div
        v-if="!snapshot.profiles.length"
        class="text-base-content/60 p-6 text-center text-sm"
      >
        {{ $t('noProfiles') }}
      </div>

      <div
        v-for="profile in snapshot.profiles"
        :key="profile.id"
        class="card bg-base-100 gap-3 p-4"
        :class="profile.id === snapshot.activeId ? 'ring-primary ring-2' : ''"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex min-w-0 flex-col">
            <div class="flex items-center gap-2">
              <span class="truncate font-medium">{{ profile.name }}</span>
              <span
                v-if="profile.id === snapshot.activeId"
                class="badge badge-primary badge-sm"
              >
                {{ $t('active') }}
              </span>
            </div>
            <span class="text-base-content/60 truncate text-xs">
              {{ profile.type === 'remote' ? profile.url : $t('localProfile') }}
            </span>
            <span class="text-base-content/60 text-xs">
              {{ $t('updatedAt') }}: {{ formatTime(profile.updatedAt) }}
            </span>
          </div>
          <div class="flex shrink-0 gap-1">
            <button
              v-if="profile.id !== snapshot.activeId"
              class="btn btn-primary btn-xs"
              :disabled="busy"
              @click="run(() => activateProfile(profile.id))"
            >
              {{ $t('use') }}
            </button>
            <button
              v-if="profile.type === 'remote'"
              class="btn btn-xs"
              :disabled="busy"
              @click="run(() => refreshProfile(profile.id))"
            >
              {{ $t('update') }}
            </button>
            <button
              class="btn btn-xs btn-error btn-outline"
              :disabled="busy"
              @click="handlerRemove(profile)"
            >
              {{ $t('delete') }}
            </button>
          </div>
        </div>

        <!-- 订阅流量 / 到期 -->
        <div
          v-if="profile.subscriptionInfo"
          class="flex flex-col gap-1"
        >
          <progress
            class="progress progress-primary h-1.5"
            :value="usedRatio(profile.subscriptionInfo)"
            max="1"
          ></progress>
          <div class="text-base-content/60 flex justify-between text-xs">
            <span>
              {{ prettyBytesHelper(used(profile.subscriptionInfo)) }}
              <template v-if="profile.subscriptionInfo.total">
                / {{ prettyBytesHelper(profile.subscriptionInfo.total) }}
              </template>
            </span>
            <span v-if="profile.subscriptionInfo.expire">
              {{ $t('expire') }}: {{ formatTime(profile.subscriptionInfo.expire * 1000) }}
            </span>
          </div>
        </div>

        <div
          v-if="profile.type === 'remote'"
          class="flex items-center gap-2 text-xs"
        >
          <span>{{ $t('autoUpdateInterval') }}</span>
          <input
            class="input input-xs w-24"
            type="number"
            min="0"
            :value="profile.updateInterval ?? 0"
            @change="handlerInterval(profile, $event)"
          />
          <span class="text-base-content/60">{{ $t('minutes') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePaddingForViews } from '@/composables/paddingViews'
import {
  activateProfile,
  desktopProfiles,
  importProfileFromText,
  importProfileFromUrl,
  patchProfile,
  refreshProfile,
  removeProfile,
} from '@/composables/desktop'
import { showConfirmDialog } from '@/helper/confirmDialog'
import { prettyBytesHelper } from '@/helper/utils'
import dayjs from 'dayjs'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { padding } = usePaddingForViews({ offsetTop: 0, offsetBottom: 8 })

const snapshot = desktopProfiles
const importUrl = ref('')
const busy = ref(false)
const error = ref('')
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const formatTime = (ms: number) => (ms ? dayjs(ms).format('YYYY-MM-DD HH:mm') : '-')

const used = (info: DesktopSubscriptionInfo) => info.upload + info.download
const usedRatio = (info: DesktopSubscriptionInfo) =>
  info.total > 0 ? Math.min(1, used(info) / info.total) : 0

// Every mutation goes through here: the shell does the real work (download,
// kernel validation, restart), so failures are worth surfacing verbatim —
// "the kernel rejected this profile" plus its parse error is the whole
// diagnosis for a bad subscription.
const run = async (action: () => Promise<void>) => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

const handlerImportUrl = () => {
  const url = importUrl.value.trim()

  if (!url) return

  return run(async () => {
    await importProfileFromUrl(url)
    importUrl.value = ''
  })
}

const handlerImportFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  input.value = ''
  if (!file) return

  return run(async () => {
    const content = await file.text()

    await importProfileFromText(file.name.replace(/\.(ya?ml|txt)$/i, ''), content)
  })
}

const handlerRemove = async (profile: DesktopProfile) => {
  const { confirmed } = await showConfirmDialog({
    message: t('confirmDeleteProfile', { name: profile.name }),
    confirmButtonClass: 'btn-error',
  })

  if (!confirmed) return

  return run(() => removeProfile(profile.id))
}

const handlerInterval = (profile: DesktopProfile, event: Event) => {
  const updateInterval = Number((event.target as HTMLInputElement).value)

  if (!Number.isFinite(updateInterval)) return

  return run(() => patchProfile(profile.id, { updateInterval }))
}
</script>
