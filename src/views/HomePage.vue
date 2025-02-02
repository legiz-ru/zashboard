<template>
  <div class="w-128 drawer md:drawer-open">
    <input
      id="sidebar"
      type="checkbox"
      class="drawer-toggle"
    />

    <SideBar />

    <div
      class="drawer-content flex h-full w-full flex-col overflow-hidden bg-base-200/40 md:relative md:w-auto"
      ref="swiperRef"
    >
      <div
        v-if="ctrlComp && isSidebarCollapsed"
        class="w-full bg-base-100"
      >
        <component
          :is="ctrlComp"
          :horizontal="true"
        />
      </div>
      <div class="relative h-0 flex-1">
        <div class="absolute flex h-full w-full flex-col overflow-y-auto">
          <RouterView v-slot="{ Component, route }">
            <Transition :name="(route.meta.transition as string) || 'fade'">
              <Component :is="Component" />
            </Transition>
          </RouterView>
        </div>
      </div>
      <div
        class="shrink-0 md:hidden"
        :class="isPWA ? 'max-md:h-[5.5rem]' : 'max-md:h-14'"
      />
      <div :class="`btm-nav z-30 bg-base-200 md:hidden ${isPWA ? 'h-[5.5rem] pb-8' : 'h-14'}`">
        <button
          v-for="r in renderRoutes"
          :key="r"
          @click="router.push({ name: r })"
          :class="r === route.name ? 'active bg-inherit' : ''"
        >
          <component
            :is="ROUTE_ICON_MAP[r]"
            class="h-5 w-5"
          />
          <span class="text-xs">
            {{ $t(r) }}
          </span>
        </button>
      </div>
    </div>

    <DialogWrapper v-model="autoSwitchBackendDialog">
      <h3 class="text-lg font-bold">{{ $t('currentBackendUnavailable') }}</h3>
      <div class="flex justify-end gap-2">
        <button
          class="btn btn-sm"
          @click="autoSwitchBackendDialog = false"
        >
          {{ $t('cancel') }}
        </button>
        <button
          class="btn btn-primary btn-sm"
          @click="autoSwitchBackend"
        >
          {{ $t('confirm') }}
        </button>
      </div>
    </DialogWrapper>
  </div>
</template>

<script setup lang="ts">
import { isBackendAvailable } from '@/api'
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import ConnectionCtrl from '@/components/sidebar/ConnectionCtrl.tsx'
import LogsCtrl from '@/components/sidebar/LogsCtrl.tsx'
import ProxiesCtrl from '@/components/sidebar/ProxiesCtrl.tsx'
import RulesCtrl from '@/components/sidebar/RulesCtrl.vue'
import SideBar from '@/components/sidebar/SideBar.vue'
import { useProxies } from '@/composables/proxies'
import { rulesTabShow } from '@/composables/rules'
import { useSettings } from '@/composables/settings'
import { useSwipeRouter } from '@/composables/swipe'
import { useNotification } from '@/composables/tip'
import { PROXY_TAB_TYPE, ROUTE_ICON_MAP, ROUTE_NAME, RULE_TAB_TYPE } from '@/config'
import { getUrlFromBackend, renderRoutes } from '@/helper'
import { fetchConfigs } from '@/store/config'
import { initConnections } from '@/store/connections'
import { initLogs } from '@/store/logs'
import { initSatistic } from '@/store/overview'
import { fetchProxies } from '@/store/proxies'
import { fetchRules } from '@/store/rules'
import { isSidebarCollapsed } from '@/store/settings'
import { activeBackend, activeUuid, backendList } from '@/store/setup'
import { useDocumentVisibility } from '@vueuse/core'
import { computed, ref, watch, type Component } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

const isPWA = (() => {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
})()

const ctrlsMap: Record<string, Component> = {
  [ROUTE_NAME.connections]: ConnectionCtrl,
  [ROUTE_NAME.logs]: LogsCtrl,
  [ROUTE_NAME.proxies]: ProxiesCtrl,
  [ROUTE_NAME.rules]: RulesCtrl,
}

const router = useRouter()
const route = useRoute()
const ctrlComp = computed(() => {
  return ctrlsMap[route.name as keyof typeof ctrlsMap]
})
const { proxiesTabShow } = useProxies()
const { swiperRef } = useSwipeRouter()

watch(
  activeUuid,
  () => {
    if (!activeUuid.value) return
    rulesTabShow.value = RULE_TAB_TYPE.RULES
    proxiesTabShow.value = PROXY_TAB_TYPE.PROXIES
    fetchConfigs()
    fetchProxies()
    fetchRules()
    initConnections()
    initLogs()
    initSatistic()
  },
  {
    immediate: true,
  },
)

const autoSwitchBackendDialog = ref(false)
const { showNotification } = useNotification()
const autoSwitchBackend = async () => {
  const otherEnds = backendList.value.filter((end) => end.uuid !== activeUuid.value)

  autoSwitchBackendDialog.value = false
  const avaliable = (
    await Promise.all(
      otherEnds.map(async (end) => {
        return (await isBackendAvailable(end)) ? end : null
      }),
    )
  ).filter((end) => end !== null)

  if (avaliable.length > 0) {
    activeUuid.value = avaliable[0].uuid
    showNotification({
      content: 'backendSwitchTo',
      params: {
        backend: getUrlFromBackend(avaliable[0]),
      },
    })
  }
}

const documentVisible = useDocumentVisibility()

watch(
  documentVisible,
  async () => {
    if (
      !activeBackend.value ||
      backendList.value.length < 2 ||
      documentVisible.value !== 'visible'
    ) {
      return
    }
    try {
      const isAvailable = await isBackendAvailable(activeBackend.value)

      if (!isAvailable) {
        autoSwitchBackendDialog.value = true
      }
    } catch {
      autoSwitchBackendDialog.value = true
    }
  },
  {
    immediate: true,
  },
)

const { checkUIUpdate } = useSettings()

checkUIUpdate()
</script>
