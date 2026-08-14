<template>
  <div
    v-if="isDesktop"
    class="bg-base-200 border-base-300 flex h-8 shrink-0 items-center border-b select-none"
    :class="isMac ? 'pl-20' : 'pl-3'"
    style="-webkit-app-region: drag"
    @dblclick="desktopWindow?.toggleMaximize()"
  >
    <span class="text-base-content/70 truncate text-xs">zashboard</span>
    <div
      v-if="!isMac"
      class="ml-auto flex h-full"
      style="-webkit-app-region: no-drag"
    >
      <button
        class="hover:bg-base-300 flex h-full w-11 items-center justify-center"
        :aria-label="$t('minimize')"
        @click="desktopWindow?.minimize()"
      >
        <MinusIcon class="h-3.5 w-3.5" />
      </button>
      <button
        class="hover:bg-base-300 flex h-full w-11 items-center justify-center"
        :aria-label="$t('maximize')"
        @click="desktopWindow?.toggleMaximize()"
      >
        <Square2StackIcon
          v-if="maximized"
          class="h-3.5 w-3.5"
        />
        <StopIcon
          v-else
          class="h-3 w-3"
        />
      </button>
      <button
        class="hover:bg-error hover:text-error-content flex h-full w-11 items-center justify-center"
        :aria-label="$t('close')"
        @click="desktopWindow?.close()"
      >
        <XMarkIcon class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { desktopWindow, isDesktop } from '@/composables/desktop'
import { MinusIcon, Square2StackIcon, StopIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { onMounted, onUnmounted, ref } from 'vue'

// macOS keeps its own traffic lights (the window uses hiddenInset), so the bar
// only reserves room for them and draws no buttons of its own.
const isMac = /Mac/i.test(navigator.userAgent)
const maximized = ref(false)

let stop: (() => void) | undefined

onMounted(async () => {
  if (!desktopWindow) return
  maximized.value = await desktopWindow.isMaximized()
  stop = desktopWindow.onMaximizeChange((value) => {
    maximized.value = value
  })
})

onUnmounted(() => stop?.())
</script>
