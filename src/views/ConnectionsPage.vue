<template>
  <div class="size-full overflow-x-hidden">
    <ConnectionCardList
      v-if="useConnectionCard"
      class="overflow-x-hidden p-2"
    />
    <ConnectionTable v-else />
    <ConnectionDetails />
  </div>
</template>

<script setup lang="ts">
import ConnectionCardList from '@/components/connections/ConnectionCardList.vue'
import ConnectionDetails from '@/components/connections/ConnectionDetails.vue'
import ConnectionTable from '@/components/connections/ConnectionTable.vue'
import { useConnectionCard } from '@/store/settings'
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
