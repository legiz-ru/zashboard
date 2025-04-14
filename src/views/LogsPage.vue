<template>
  <div class="size-full overflow-x-hidden">
    <template v-if="!renderLogs.length">
      <div class="card m-2 flex-row p-2 text-sm">
        {{ $t('noContent') }}
      </div>
    </template>
    <VirtualScroller
      v-else
      :data="renderLogs"
      :size="isMiddleScreen ? 96 : 64"
      class="p-2"
    >
      <template v-slot="{ item }: { item: LogWithSeq }">
        <LogsCard :log="item"></LogsCard>
      </template>
    </VirtualScroller>
  </div>
</template>

<script setup lang="ts">
import VirtualScroller from '@/components/common/VirtualScroller.vue'
import LogsCard from '@/components/logs/LogsCard.vue'
import { isMiddleScreen } from '@/helper/utils'
import { logFilter, logs } from '@/store/logs'
import type { LogWithSeq } from '@/types'
import { computed } from 'vue'

const renderLogs = computed(() => {
  if (logFilter.value) {
    const regex = new RegExp(logFilter.value, 'i')

    return logs.value.filter((log) => {
      return [log.payload, log.time, log.type].some((i) => regex.test(i))
    })
  }

  return logs.value
})
</script>
