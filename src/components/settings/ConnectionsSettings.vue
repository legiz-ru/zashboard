<template>
  <!-- connections -->
  <div class="card card-compact">
    <div class="card-title px-4 pt-4">
      {{ $t('connections') }}
    </div>
    <div class="card-body">
      <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div class="flex items-center gap-2">
          <span class="whitespace-nowrap">
            {{ $t('connectionStyle') }}:
            {{ $t('table') }}
          </span>
          <input
            class="toggle"
            type="checkbox"
            v-model="useConnectionCard"
          />
          {{ $t('card') }}
        </div>
        <div class="flex items-center gap-2">
          {{ $t('proxyChainDirection') }}:
          <select
            class="select select-bordered select-sm w-24"
            v-model="proxyChainDirection"
          >
            <option
              v-for="opt in Object.values(PROXY_CHAIN_DIRECTION)"
              :key="opt"
              :value="opt"
            >
              {{ $t(opt) }}
            </option>
          </select>
        </div>
      </div>

      <ConnectionCardSettings v-if="useConnectionCard" />
      <TableSettings v-else />
      <div class="divider"></div>
      <SourceIPLabels />
    </div>
  </div>
</template>

<script setup lang="ts">
import ConnectionCardSettings from '@/components/settings/ConnectionCardSettings.vue'
import SourceIPLabels from '@/components/settings/SourceIPLabels.vue'
import TableSettings from '@/components/settings/TableSettings.vue'
import { PROXY_CHAIN_DIRECTION } from '@/config'
import { proxyChainDirection, useConnectionCard } from '@/store/settings'
</script>
