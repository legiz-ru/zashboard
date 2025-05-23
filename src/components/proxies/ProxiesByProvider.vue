<script setup lang="ts">
import { handlerProxySelect, proxyProviederList } from '@/store/proxies'
import { twoColumnProxyGroup } from '@/store/settings'
import { computed } from 'vue'
import ProxyNodeCard from './ProxyNodeCard.vue'
import ProxyNodeGrid from './ProxyNodeGrid.vue'

const props = defineProps<{
  name: string
  now: string
  renderProxies: string[]
  showFullContent: boolean
}>()

const groupedProxies = computed(() => {
  const renders: Record<string, string[]> = {}

  for (const proxy of props.renderProxies) {
    const providerName =
      proxyProviederList.value.find((group) => group.proxies.find((node) => node.name === proxy))
        ?.name ?? ''

    if (renders[providerName]) {
      renders[providerName].push(proxy)
    } else {
      renders[providerName] = [proxy]
    }
  }

  return Object.entries(renders)
})
</script>

<template>
  <div class="flex max-h-96 flex-col gap-2 overflow-x-hidden overflow-y-auto">
    <div
      v-for="([providerName, proxies], index) in groupedProxies"
      :key="index"
    >
      <p
        class="my-2 text-sm font-semibold"
        v-if="providerName !== ''"
      >
        {{ providerName }}
      </p>
      <ProxyNodeGrid style="max-height: unset !important">
        <ProxyNodeCard
          v-for="node in showFullContent
            ? proxies
            : proxies.slice(0, twoColumnProxyGroup ? 36 : 72)"
          :key="node"
          :name="node"
          :group-name="name"
          :active="node === now"
          @click="handlerProxySelect(name, node)"
        />
      </ProxyNodeGrid>
    </div>
  </div>
</template>
