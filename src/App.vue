<script setup lang="ts">
import { XCircleIcon } from '@heroicons/vue/24/outline'
import { useMediaQuery } from '@vueuse/core'
import dayjs from 'dayjs'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useNotification } from './composables/tip'
import { FONTS } from './config'
import { getBase64FromIndexedDB, LOCAL_IMAGE } from './helper/utils'
import { customBackgroundURL, dashboardTransparent, font, theme } from './store/settings'

const app = ref<HTMLElement>()
const { tipContent, tipShowModel, tipType } = useNotification()
const fontClassMap = {
  [FONTS.MI_SANS]: 'font-MiSans',
  [FONTS.SARASA_UI]: 'font-SarasaUI',
  [FONTS.PING_FANG]: 'font-PingFang',
  [FONTS.FIRA_SANS]: 'font-FiraSans',
  [FONTS.SYSTEM_UI]: 'font-SystemUI',
}
const fontClassName = computed(() => fontClassMap[font.value])
const date = dayjs().format('YYYY-MM-DD')

const backgroundInDB = ref('')
const getBackgroundInDB = async () => {
  backgroundInDB.value = (await getBase64FromIndexedDB()) || ''
}

watch(
  () => customBackgroundURL.value,
  () => {
    if (customBackgroundURL.value.includes(LOCAL_IMAGE)) {
      getBackgroundInDB()
    }
  },
  {
    immediate: true,
  },
)

const backgroundImage = computed(() => {
  if (customBackgroundURL.value.includes(LOCAL_IMAGE)) {
    return backgroundInDB.value
  }
  return customBackgroundURL.value + `?v=${date}`
})
const isPreferredDark = useMediaQuery('(prefers-color-scheme: dark)')

const setThemeColor = () => {
  const themeColor = getComputedStyle(app.value!).getPropertyValue('background-color').trim()
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', themeColor)
  }
}

watch(isPreferredDark, setThemeColor)

onMounted(() => {
  watch(
    theme,
    () => {
      document.body.setAttribute('data-theme', theme.value)
      setThemeColor()
    },
    {
      immediate: true,
    },
  )
})
</script>

<template>
  <div
    ref="app"
    id="app-content"
    :class="`flex h-dvh w-screen overflow-x-hidden bg-base-100 ${fontClassName} custom-background-${dashboardTransparent} ${customBackgroundURL && 'custom-background bg-cover bg-center'}`"
    :style="`background-image: url('${backgroundImage}');`"
  >
    <RouterView />
    <div
      class="toast-sm toast toast-end top-8 z-50 max-w-64 text-sm"
      v-if="tipShowModel"
    >
      <div
        class="breaks-all alert flex whitespace-normal p-2"
        :class="tipType"
      >
        <a
          href="https://github.com/Zephyruso/zashboard/blob/main/README.md"
          target="_blank"
          class="flex-1"
        >
          {{ tipContent }}
        </a>
        <button
          class="btn btn-circle btn-ghost btn-sm"
          @click="tipShowModel = false"
        >
          <XCircleIcon class="w-4 cursor-pointer" />
        </button>
      </div>
    </div>
  </div>
</template>
