<template>
  <div class="size-full overflow-x-hidden">
    <ConnectionCardList
      v-if="useConnectionCard"
      class="overflow-x-hidden p-2"
    />
    <ConnectionTable v-else />
    <DialogWrapper v-model="connectionDetailModalShow">
      <VueJsonPretty :data="infoConn" />
    </DialogWrapper>
  </div>
</template>

<script setup lang="ts">
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import ConnectionCardList from '@/components/connections/ConnectionCardList.vue'
import ConnectionTable from '@/components/connections/ConnectionTable.vue'
import { useConnections } from '@/composables/connections'
import { useConnectionCard } from '@/store/settings'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'

const { infoConn, connectionDetailModalShow } = useConnections()
</script>

<style>
.vjs-tree {
  font-family:
    NotoEmoji,
    Monaco,
    Menlo,
    Consolas,
    Bitstream Vera Sans Mono,
    monospace;
}
.vjs-tree-node.is-highlight,
.vjs-tree-node:hover {
  @apply !bg-base-200;
}
</style>
