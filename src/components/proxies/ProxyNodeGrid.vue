<template>
  <div
    :class="
      twMerge(
        'grid grid-cols-2 gap-2 overflow-y-auto overflow-x-hidden',
        truncateProxyName && 'max-h-96',
        proxyCardSize === PROXY_CARD_SIZE.LARGE
          ? isSidebarCollapsed
            ? hasTwoColumns
              ? 'sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5'
              : 'sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10'
            : hasTwoColumns
              ? 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-4'
              : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8'
          : isSidebarCollapsed
            ? hasTwoColumns
              ? 'sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6'
              : 'sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 3xl:grid-cols-12'
            : hasTwoColumns
              ? 'sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5'
              : 'sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10',
      )
    "
  >
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { useProxies } from '@/composables/proxies'
import { PROXY_CARD_SIZE } from '@/config'
import { isSidebarCollapsed, proxyCardSize, truncateProxyName } from '@/store/settings'
import { twMerge } from 'tailwind-merge'

const { hasTwoColumns } = useProxies()
</script>

<style scoped>
.grid {
  scrollbar-width: thin;
}
</style>
