<template>
  <div class="tabs-boxed tabs tabs-sm">
    <a
      v-for="tab in Object.values(CONNECTION_TAB_TYPE)"
      :key="tab"
      role="tab"
      :class="twMerge('tab', connectionTabShow === tab && 'tab-active')"
      @click="() => (connectionTabShow = tab)"
      >{{ $t(tab) }}
      <template v-if="connectionTabShow === tab"> ({{ connectionsCount }}) </template>
    </a>
  </div>
</template>

<script setup lang="ts">
import { CONNECTION_TAB_TYPE } from '@/config'
import { connections, connectionTabShow, renderConnections } from '@/store/connections'
import { twMerge } from 'tailwind-merge'
import { computed } from 'vue'

const connectionsCount = computed(() => {
  if (renderConnections.value.length !== connections.value.length) {
    return `${renderConnections.value.length} / ${connections.value.length}`
  }

  return connections.value.length
})
</script>
