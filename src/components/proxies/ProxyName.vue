<template>
  <div
    class="flex items-center gap-1 break-all"
    :class="size === 'large' ? 'text-lg font-medium' : 'text-sm'"
  >
    <ProxyIcon
      v-if="icon"
      :icon="icon"
      :size="size"
      :class="size === 'large' && '-mt-[2px]'"
    />
    {{ name }}
  </div>
</template>

<script setup lang="ts">
import { proxyMap } from '@/store/proxies'
import { computed } from 'vue'
import ProxyIcon from './ProxyIcon.vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: 'small' | 'large'
  }>(),
  {
    size: 'small',
  },
)

const icon = computed(() => {
  return proxyMap.value[props.name]?.icon
})
</script>
