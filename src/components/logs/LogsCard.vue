<template>
  <div class="card mb-1 block p-2 text-sm break-all">
    <span>{{ log.seq }}</span>
    <span class="text-main mx-2">
      {{ log.time }}
    </span>
    <span :class="textColorMapForType[log.type as keyof typeof textColorMapForType]">
      {{ log.type }}
    </span>
    <span class="ml-2">{{ log.payload }}</span>
  </div>
</template>

<script setup lang="ts">
import { useBounceOnVisible } from '@/composables/bouncein'
import { LOG_LEVEL } from '@/constant'
import type { LogWithSeq } from '@/types'

defineProps<{
  log: LogWithSeq
}>()

const textColorMapForType = {
  [LOG_LEVEL.Trace]: 'text-success',
  [LOG_LEVEL.Debug]: 'text-accent',
  [LOG_LEVEL.Info]: 'text-info',
  [LOG_LEVEL.Warning]: 'text-warning',
  [LOG_LEVEL.Error]: 'text-error',
  [LOG_LEVEL.Fatal]: 'text-error',
  [LOG_LEVEL.Panic]: 'text-error',
}

useBounceOnVisible()
</script>
