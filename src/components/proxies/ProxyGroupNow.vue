<template>
  <template v-if="proxyGroup.now">
    <template v-if="icon">
      <LockClosedIcon
        class="h-4 w-4 shrink-0"
        v-if="proxyGroup.fixed === proxyGroup.now"
        @mouseenter="tipForFixed"
      />
      <ArrowRightCircleIcon
        class="h-4 w-4 shrink-0"
        v-else
      />
    </template>

    <ProxyName
      :name="proxyGroup.now"
      @mouseenter="tipForNow"
    />
  </template>
  <template v-else-if="proxyGroup.type.toLowerCase() === PROXY_TYPE.LoadBalance">
    <CheckCircleIcon
      class="h-4 w-4 shrink-0"
      v-if="icon"
    />
    {{ $t('loadBalance') }}
  </template>
  <template v-if="proxyGroup.type.toLowerCase() === PROXY_TYPE.Smart">
    <div
      class="btn btn-xs h-5"
      @click="displayWeights"
    >
      {{ $t('displayWeights') }}
    </div>
    <WeightsModal
      @click.stop
      @contextmenu.stop
      :name="proxyGroup.name"
      :is-open="isWeightsModalOpen"
      @update:is-open="isWeightsModalOpen = $event"
    />
  </template>
</template>

<script setup lang="ts">
import { PROXY_TYPE } from '@/constant'
import { useTooltip } from '@/helper/tooltip'
import { getNowProxyNodeName, proxyMap } from '@/store/proxies'
import { ArrowRightCircleIcon, CheckCircleIcon, LockClosedIcon } from '@heroicons/vue/24/outline'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ProxyName from './ProxyName.vue'
import WeightsModal from './WeightsModal.vue'

const isWeightsModalOpen = ref(false)
const props = defineProps<{
  name: string
  icon?: boolean
}>()
const proxyGroup = computed(() => proxyMap.value[props.name])

const { showTip } = useTooltip()
const tipForNow = (e: Event) => {
  const nowNode = getNowProxyNodeName(props.name)
  if (!nowNode || nowNode === proxyGroup.value.now) return

  showTip(e, nowNode, {
    delay: [500, 0],
  })
}

const { t } = useI18n()
const tipForFixed = (e: Event) => {
  showTip(e, t('tipForFixed'), {
    delay: [500, 0],
  })
}

const displayWeights = async (e: Event) => {
  e.stopPropagation()
  isWeightsModalOpen.value = true
}
</script>
