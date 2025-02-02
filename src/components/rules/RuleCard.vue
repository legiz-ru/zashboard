<template>
  <div :class="twMerge('card gap-2 p-2 text-sm', !rule.payload && 'gap-0')">
    <div>
      <span class="mr-2 inline-block min-w-4 text-center">{{ index }}.</span>
      <span class="mr-2 text-primary">{{ rule.type }}</span>
      <span
        class="mr-2"
        v-if="rule.payload"
      >
        {{ rule.payload }}
      </span>
      <span
        v-if="typeof rule.size === 'number' && rule.size !== -1"
        class="badge badge-sm bg-base-200"
      >
        {{ rule.size }}
      </span>
    </div>
    <div class="flex items-center gap-1 text-base-content/80">
      <ProxyName
        :name="rule.proxy"
        class="text-xs"
      />
      <template v-if="proxyNode?.now">
        <ArrowRightCircleIcon class="h-4 w-4" />
        <ProxyName
          :name="proxyNode.now"
          class="text-xs"
        />
      </template>
      <span
        v-if="latency !== NOT_CONNECTED"
        :class="latencyColor"
        class="ml-1 text-xs"
        >{{ latency }}ms</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { NOT_CONNECTED } from '@/config'
import { getColorForLatency } from '@/helper'
import { getLatencyByName, proxyMap } from '@/store/proxies'
import type { Rule } from '@/types'
import { ArrowRightCircleIcon } from '@heroicons/vue/24/outline'
import { twMerge } from 'tailwind-merge'
import { computed } from 'vue'
import ProxyName from '../proxies/ProxyName.vue'

const props = defineProps<{
  rule: Rule
  index: number
}>()

const proxyNode = computed(() => proxyMap.value[props.rule.proxy])
const latency = computed(() => getLatencyByName(props.rule.proxy, props.rule.proxy))
const latencyColor = computed(() => getColorForLatency(Number(latency.value)))
</script>
