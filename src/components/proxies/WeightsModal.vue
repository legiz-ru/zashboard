<script setup lang="ts">
import { fetchSmartGroupWeightsAPI } from '@/api'
import { ref, watch } from 'vue'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import DialogWrapper from '../common/DialogWrapper.vue'

const props = defineProps<{ name: string }>()
const isOpen = defineModel('isOpen', { default: false })
const weights = ref()

watch(isOpen, (val) => {
  if (!val) {
    return
  }
  fetchSmartGroupWeightsAPI(props.name).then((res) => {
    weights.value = res.data.weights
  })
})
</script>

<template>
  <DialogWrapper v-model="isOpen">
    <div class="my-2 flex flex-col items-start gap-2">
      <VueJsonPretty :data="weights" />
    </div>
  </DialogWrapper>
</template>
