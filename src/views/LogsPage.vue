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
        <div class="card mb-1 block break-all p-2 text-sm">
          <span>{{ item.seq }}</span>
          <span class="mx-2 text-primary">
            {{ item.time }}
          </span>
          <span :class="textColorMapForType[item.type as keyof typeof textColorMapForType]">
            {{ item.type }}
          </span>
          <span class="ml-2">{{ item.payload }}</span>
        </div>
      </template>
    </VirtualScroller>
  </div>
</template>

<script setup lang="ts">
import VirtualScroller from '@/components/common/VirtualScroller.vue'
import { LOG_LEVEL } from '@/config'
import { isMiddleScreen } from '@/helper/utils'
import { logFilter, logs } from '@/store/logs'
import type { LogWithSeq } from '@/types'
import { computed } from 'vue'

const textColorMapForType = {
  [LOG_LEVEL.Error]: 'text-error',
  [LOG_LEVEL.Warning]: 'text-warning',
  [LOG_LEVEL.Info]: 'text-info',
  [LOG_LEVEL.Debug]: 'text-accent',
}

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
