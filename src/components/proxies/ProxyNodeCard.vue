<template>
  <div
    ref="cardRef"
    :class="
      twMerge(
        'bg-base-200 flex cursor-pointer flex-col items-start gap-[2px] rounded-md',
        active ? 'bg-primary text-primary-content' : 'sm:hover:bg-base-300',
        isSmallCard ? 'p-1' : 'p-2',
      )
    "
    @contextmenu.stop.prevent="handlerLatencyTest"
  >
    <div class="flex w-full flex-1 items-center gap-1">
      <ProxyIcon
        v-if="node?.icon"
        class="shrink-0"
        size="small"
        :icon="node.icon"
        :fill="active ? 'fill-primary-content' : 'fill-base-content'"
      />
      <span
        :class="twMerge('text-sm', truncateProxyName && 'truncate')"
        @mouseenter="checkTruncation"
      >
        {{ node.name }}
      </span>
    </div>

    <div class="flex h-4 w-full items-center justify-between select-none">
      <span
        :class="`truncate text-xs tracking-tight ${active ? 'text-primary-content' : 'text-base-content/60'}`"
        @mouseenter="checkTruncation"
      >
        {{ typeDescription }}
      </span>
      <LatencyTag
        :class="[isSmallCard && 'h-4! w-8!', 'shrink-0']"
        :name="node.name"
        :loading="isLatencyTesting"
        :group-name="groupName"
        @click.stop="handlerLatencyTest"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { PROXY_CARD_SIZE } from '@/constant'
import { useTooltip } from '@/helper/tooltip'
import { getIPv6ByName, getTestUrl, proxyLatencyTest, proxyMap } from '@/store/proxies'
import { IPv6test, proxyCardSize, truncateProxyName } from '@/store/settings'
import { twMerge } from 'tailwind-merge'
import { computed, ref } from 'vue'
import LatencyTag from './LatencyTag.vue'
import ProxyIcon from './ProxyIcon.vue'

const props = defineProps<{
  name: string
  active?: boolean
  groupName?: string
}>()

const { showTip } = useTooltip()
const checkTruncation = (e: Event) => {
  const target = e.target as HTMLElement
  const { scrollWidth, clientWidth } = target

  if (scrollWidth > clientWidth) {
    showTip(e, target.innerText, {
      delay: [1000, 0],
      trigger: 'mouseenter',
      touch: ['hold', 500],
    })
  }
}

const node = computed(() => proxyMap.value[props.name])
const isLatencyTesting = ref(false)
const typeFormatter = (type: string) => {
  type = type.toLowerCase()
  type = type.replace('shadowsocks', 'ss')
  type = type.replace('hysteria', 'hy')
  type = type.replace('wireguard', 'wg')

  return type
}
const isSmallCard = computed(() => proxyCardSize.value === PROXY_CARD_SIZE.SMALL)
const typeDescription = computed(() => {
  const type = typeFormatter(node.value.type)
  const isV6 = IPv6test.value && getIPv6ByName(node.value.name) ? 'IPv6' : ''
  const isUDP = node.value.xudp ? 'xudp' : node.value.udp ? 'udp' : ''

  return [type, isUDP, isV6].filter(Boolean).join(isSmallCard.value ? '/' : ' / ')
})
const handlerLatencyTest = async () => {
  if (isLatencyTesting.value) return

  isLatencyTesting.value = true
  try {
    await proxyLatencyTest(props.name, getTestUrl(props.groupName))
    isLatencyTesting.value = false
  } catch {
    isLatencyTesting.value = false
  }
}
</script>

<style scoped>
.tooltip:before {
  z-index: 20;
}
</style>
