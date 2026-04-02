<template>
  <div class="scroller-item hover:bg-base-200/40 px-4 py-2.5 sm:flex sm:items-center sm:gap-4">
    <div class="flex min-w-0 items-center gap-2 sm:flex-1">
      <span class="text-base-content/40 shrink-0 text-xs tabular-nums">{{ index }}</span>
      <span class="min-w-0 truncate text-sm">{{ ruleProvider.name }}</span>
      <span class="text-base-content/50 shrink-0 text-xs tabular-nums">
        · {{ ruleProvider.ruleCount }} {{ $t('rules') }}
      </span>
    </div>
    <div class="text-base-content/40 mt-1.5 flex items-center gap-1.5 text-xs sm:mt-0">
      <span v-if="ruleProvider.behavior">{{ ruleProvider.behavior }}</span>
      <span v-if="ruleProvider.behavior && ruleProvider.vehicleType">·</span>
      <span v-if="ruleProvider.vehicleType">{{ ruleProvider.vehicleType }}</span>
    </div>
    <div class="mt-1 flex items-center justify-between sm:mt-0 sm:shrink-0">
      <span class="text-base-content/40 text-xs">
        {{ $t('updated') }} {{ fromNow(ruleProvider.updatedAt) }}
      </span>
      <button
        v-if="ruleProvider.vehicleType !== 'Inline'"
        :class="
          twMerge('btn btn-circle btn-ghost btn-xs sm:ml-1.5', isUpdating ? 'animate-spin' : '')
        "
        @click="updateRuleProviderClickHandler"
      >
        <ArrowPathIcon class="h-3.5 w-3.5 opacity-60" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { updateRuleProviderAPI } from '@/api'
import { useBounceOnVisible } from '@/composables/bouncein'
import { fromNow } from '@/helper/utils'
import { fetchRules } from '@/store/rules'
import type { RuleProvider } from '@/types'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { twMerge } from 'tailwind-merge'
import { ref } from 'vue'
const isUpdating = ref(false)
const props = defineProps<{
  ruleProvider: RuleProvider
  index: number
}>()

const updateRuleProviderClickHandler = async () => {
  if (isUpdating.value) return

  isUpdating.value = true
  await updateRuleProviderAPI(props.ruleProvider.name)
  fetchRules()
  isUpdating.value = false
}

useBounceOnVisible()
</script>
