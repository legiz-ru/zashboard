<template>
  <button
    class="btn btn-sm"
    @click="importSettings"
  >
    {{ $t('importSettings') }}
  </button>
  <input
    ref="inputRef"
    type="file"
    accept=".json"
    class="hidden"
    @change="handlerJsonUpload"
  />
</template>

<script setup lang="ts">
import { useNotification } from '@/composables/notification'
import { i18n } from '@/i18n'
import { ref } from 'vue'

const inputRef = ref<HTMLInputElement>()
const importSettings = () => {
  inputRef.value?.click()
}
const handlerJsonUpload = () => {
  const { showNotification } = useNotification()

  showNotification({
    content: i18n.global.t('importing'),
  })
  const file = inputRef.value?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    const settings = JSON.parse(reader.result as string)

    for (const key in settings) {
      localStorage.setItem(key, settings[key])
    }
    location.reload()
  }
  reader.readAsText(file)
}
</script>
