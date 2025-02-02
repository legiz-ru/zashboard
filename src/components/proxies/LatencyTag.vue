<template>
  <div
    :class="
      twMerge(
        'latency-tag flex h-5 w-10 items-center justify-center rounded-xl bg-base-100 text-xs md:hover:bg-base-200',
        color,
      )
    "
  >
    <span
      v-if="loading"
      class="loading loading-dots loading-xs text-base-content/80"
    ></span>
    <BoltIcon
      v-else-if="latency === NOT_CONNECTED || !latency"
      class="h-3 w-3 text-base-content"
    />
    <div
      v-show="latency !== NOT_CONNECTED && !loading"
      ref="latencyRef"
    >
      {{ latency }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { NOT_CONNECTED } from '@/config'
import { getColorForLatency } from '@/helper'
import { getLatencyByName } from '@/store/proxies'
import { BoltIcon } from '@heroicons/vue/24/outline'
import { CountUp } from 'countup.js'
import { twMerge } from 'tailwind-merge'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  name?: string
  loading?: boolean
  groupName?: string
}>()
const latencyRef = ref()
const latency = computed(() => getLatencyByName(props.name ?? '', props.groupName))
let countUp: CountUp | null = null

onMounted(() => {
  watch(latency, (value, OldValue) => {
    if (!countUp) {
      nextTick(() => {
        countUp = new CountUp(latencyRef.value, latency.value, {
          duration: 1,
          separator: '',
          enableScrollSpy: false,
          startVal: OldValue,
        })
        countUp?.update(value)
      })
    } else {
      countUp?.update(value)
    }
  })
})

onUnmounted(() => {
  countUp = null
})

const color = computed(() => {
  return getColorForLatency(latency.value)
})
</script>
