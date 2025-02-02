<template>
  <div>{{ $t('sourceIPLabels') }}:</div>
  <div class="flex flex-col gap-2 p-1">
    <div
      v-for="ip in sourceIPs"
      :key="ip"
      class="flex items-center gap-2"
    >
      {{ ip }} <ArrowRightCircleIcon class="h-4 w-4" />
      <TextInput
        class="w-24"
        v-model="sourceIPLabelMap[ip]"
      />
      <button
        class="btn btn-circle btn-sm"
        @click="() => handlerLabelRemove(ip)"
      >
        <MinusCircleIcon class="h-4 w-4" />
      </button>
    </div>
    <div class="flex w-full items-center gap-1">
      <span class="shrink-0">IP :</span>
      <TextInput
        class="w-36 flex-1 sm:max-w-44"
        v-model="newLabelForIP.ip"
      />
      <ArrowRightCircleIcon class="h-4 w-4 shrink-0" />
      <TextInput
        class="w-24 sm:w-32"
        v-model="newLabelForIP.label"
      />
      <button
        class="btn btn-circle btn-sm"
        @click="handlerLabelAdd"
      >
        <PlusIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { sourceIPLabelMap } from '@/store/settings'
import { ArrowRightCircleIcon, MinusCircleIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { computed, reactive } from 'vue'
import TextInput from '../common/TextInput.vue'

const sourceIPs = computed(() => {
  return Object.keys(sourceIPLabelMap.value)
})

const newLabelForIP = reactive({
  ip: '',
  label: '',
})

const handlerLabelAdd = () => {
  sourceIPLabelMap.value[newLabelForIP.ip] = newLabelForIP.label
  newLabelForIP.ip = ''
  newLabelForIP.label = ''
}

const handlerLabelRemove = (ip: string) => {
  Reflect.deleteProperty(sourceIPLabelMap.value, ip)
  sourceIPLabelMap.value = { ...sourceIPLabelMap.value }
}
</script>
