<template>
  <div class="drawer-side z-30 bg-base-200 max-md:hidden">
    <label
      for="sidebar"
      aria-label="close sidebar"
      class="drawer-overlay"
    ></label>
    <div
      :class="
        twMerge(
          'scrollbar-hidden flex h-full flex-col gap-2 overflow-x-hidden p-2 text-base-content !transition-all duration-500',
          isSidebarCollapsed ? 'w-18 px-0' : 'w-[21rem]',
        )
      "
    >
      <ul class="menu flex-1">
        <li
          v-for="r in renderRoutes"
          :key="r"
          @mouseenter="(e) => mouseenterHandler(e, r)"
        >
          <a
            :class="r === route.name ? 'active' : 'inactive'"
            @click="() => router.push({ name: r })"
          >
            <component
              :is="ROUTE_ICON_MAP[r]"
              class="h-5 w-5"
            />
            <template v-if="!isSidebarCollapsed">
              {{ $t(r) }}
            </template>
          </a>
        </li>
      </ul>
      <template v-if="isSidebarCollapsed">
        <VerticalInfos v-if="showStatisticsWhenSidebarCollapsed" />
        <div
          v-else
          class="flex w-full items-center justify-center"
        >
          <button
            class="btn btn-circle btn-sm bg-base-300"
            @click="isSidebarCollapsed = false"
          >
            <ArrowRightCircleIcon class="h-5 w-5" />
          </button>
        </div>
      </template>
      <template v-else>
        <OverviewCarousel v-if="route.name !== ROUTE_NAME.overview" />
        <div class="card">
          <component
            v-if="sidebarComp"
            :is="sidebarComp"
          />
          <CommonSidebar />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import CommonSidebar from '@/components/sidebar/CommonCtrl.vue'
import ConnectionCtrl from '@/components/sidebar/ConnectionCtrl.tsx'
import LogsCtrl from '@/components/sidebar/LogsCtrl.tsx'
import ProxiesCtrl from '@/components/sidebar/ProxiesCtrl.tsx'
import RulesCtrl from '@/components/sidebar/RulesCtrl.vue'
import { ROUTE_ICON_MAP, ROUTE_NAME } from '@/config'
import { renderRoutes } from '@/helper'
import { useTooltip } from '@/helper/tooltip'
import router from '@/router'
import { isSidebarCollapsed, showStatisticsWhenSidebarCollapsed } from '@/store/settings'
import { ArrowRightCircleIcon } from '@heroicons/vue/24/outline'
import { twMerge } from 'tailwind-merge'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import OverviewCarousel from './OverviewCarousel.vue'
import VerticalInfos from './VerticalInfos.vue'

const { showTip } = useTooltip()
const { t } = useI18n()

const mouseenterHandler = (e: MouseEvent, r: string) => {
  if (!isSidebarCollapsed.value) return
  showTip(e, t(r), {
    placement: 'right',
  })
}

const sidebarCompMap = {
  [ROUTE_NAME.connections]: ConnectionCtrl,
  [ROUTE_NAME.logs]: LogsCtrl,
  [ROUTE_NAME.proxies]: ProxiesCtrl,
  [ROUTE_NAME.rules]: RulesCtrl,
}

const sidebarComp = computed(() => {
  if (route.name) {
    return sidebarCompMap[route.name as keyof typeof sidebarCompMap]
  }

  return null
})

const route = useRoute()
</script>
