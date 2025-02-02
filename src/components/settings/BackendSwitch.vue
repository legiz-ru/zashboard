<template>
  <div class="join flex">
    <select
      class="join-item select select-bordered select-sm w-56"
      v-model="activeUuid"
    >
      <option
        v-for="opt in opts"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label }}
      </option>
    </select>
    <button
      class="btn join-item btn-sm"
      @click="addBackend"
    >
      <PlusIcon class="h-4 w-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ROUTE_NAME } from '@/config'
import { getUrlFromBackend } from '@/helper'
import router from '@/router'
import { activeUuid, backendList } from '@/store/setup'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'

const opts = computed(() => {
  return backendList.value.map((b) => {
    return {
      label: b.label || getUrlFromBackend(b),
      value: b.uuid,
    }
  })
})

const addBackend = () => {
  activeUuid.value = null
  router.push({ name: ROUTE_NAME.setup })
}
</script>
