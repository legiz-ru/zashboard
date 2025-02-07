<template>
  <select
    v-if="!horizontal"
    class="join-item select select-bordered select-sm"
    v-model="sourceIPFilter"
  >
    <option :value="null">{{ $t('allSourceIP') }}</option>
    <option
      v-if="sourceIPOpts.every((i) => i.value !== sourceIPFilter) && sourceIPFilter !== null"
      :value="sourceIPFilter"
    >
      {{ getIPLabelFromMap(sourceIPFilter) }}
    </option>
    <option
      v-for="opt in sourceIPOpts"
      :key="opt.value"
      :value="opt.value"
    >
      {{ opt.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
import { getIPLabelFromMap } from '@/helper'
import { connections, sourceIPFilter } from '@/store/connections'
import { isEqual, uniq } from 'lodash'
import { computed, ref, watch } from 'vue'
defineProps<{
  horizontal?: boolean
}>()

const sourceIPs = computed(() => {
  return uniq(connections.value.map((conn) => conn.metadata.sourceIP)).sort()
})
const sourceIPOpts = ref<{ label: string; value: string }[]>([])

// do not use computed here for firefox
watch(
  sourceIPs,
  (value, oldValue) => {
    if (isEqual(value, oldValue)) return
    sourceIPOpts.value = sourceIPs.value.map((ip) => ({
      label: getIPLabelFromMap(ip),
      value: ip,
    }))
  },
  {
    immediate: true,
  },
)
</script>
