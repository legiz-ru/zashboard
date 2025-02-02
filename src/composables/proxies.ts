import { isSingBox } from '@/api'
import { PROXY_TAB_TYPE } from '@/config'
import { configs } from '@/store/config'
import {
  GLOBAL,
  hiddenGroupMap,
  proxyGroupList,
  proxyMap,
  proxyProviederList,
} from '@/store/proxies'
import { showGlobalProxy, showHiddenGroup, twoColumnProxyGroup } from '@/store/settings'
import { computed, ref } from 'vue'

export const proxiesFilter = ref('')

const proxiesTabShow = ref(PROXY_TAB_TYPE.PROXIES)
const renderGroups = computed(() => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    return proxyProviederList.value.map((group) => group.name)
  }

  const proxyGroups = !showHiddenGroup.value
    ? proxyGroupList.value.filter((group) => {
        return !hiddenGroupMap.value[group]
      })
    : proxyGroupList.value

  if (isSingBox.value && showGlobalProxy.value && proxyMap.value[GLOBAL]) {
    return [...proxyGroups, GLOBAL]
  }

  if (
    !isSingBox.value &&
    configs.value?.mode.toLocaleUpperCase() === GLOBAL &&
    proxyMap.value[GLOBAL]
  ) {
    return [GLOBAL]
  }
  return proxyGroups
})
const hasTwoColumns = computed(() => twoColumnProxyGroup.value && renderGroups.value.length > 1)

export const useProxies = () => {
  return {
    proxiesTabShow,
    renderGroups,
    hasTwoColumns,
  }
}
