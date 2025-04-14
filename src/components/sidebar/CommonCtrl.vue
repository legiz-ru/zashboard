<template>
  <div class="flex flex-col gap-2 p-2 text-sm">
    <StatisticsStats type="ctrl" />
    <div class="flex gap-2">
      {{ $t('version') }}
      <BackendVersion />
    </div>

    <div class="flex">
      <button
        class="btn btn-circle btn-sm"
        @click="isSidebarCollapsed = true"
      >
        <ArrowLeftCircleIcon class="h-5 w-5" />
      </button>
      <div class="flex-1"></div>
      <BackendSwitch />
    </div>
  </div>
</template>

<script setup lang="ts">
import { isSidebarCollapsed } from '@/store/settings'
import { ArrowLeftCircleIcon } from '@heroicons/vue/24/outline'
import BackendVersion from '../common/BackendVersion.vue'
import StatisticsStats from '../overview/StatisticsStats.vue'
import BackendSwitch from '../settings/BackendSwitch.vue'
</script>
