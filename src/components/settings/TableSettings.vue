<template>
  <div>{{ $t('customTableColumns') }}</div>
  <div class="flex gap-4 rounded-sm">
    <Draggable
      class="bg-base-200 flex flex-1 flex-col gap-2 p-4"
      v-model="connectionTableColumns"
      group="list"
      :animation="150"
      :item-key="(id: string) => id"
    >
      <template #item="{ element }">
        <div
          class="bg-neutral text-neutral-content flex h-8 cursor-move items-center justify-center rounded-sm px-2 select-none"
        >
          {{ $t(element) }}
        </div>
      </template>
    </Draggable>
    <Draggable
      class="flex flex-1 flex-col gap-2 p-4"
      v-model="restOfColumns"
      group="list"
      :animation="150"
      :item-key="(id: string) => id"
    >
      <template #item="{ element }">
        <div
          class="bg-base-200 text-base-content flex h-8 cursor-move items-center justify-center rounded-sm px-2 select-none"
        >
          {{ $t(element) }}
        </div>
      </template>
    </Draggable>
  </div>
</template>

<script setup lang="ts">
import { CONNECTIONS_TABLE_ACCESSOR_KEY } from '@/constant'
import { connectionTableColumns } from '@/store/settings'
import { ref } from 'vue'
import Draggable from 'vuedraggable'

const restOfColumns = ref(
  Object.values(CONNECTIONS_TABLE_ACCESSOR_KEY).filter(
    (key) => !connectionTableColumns.value.includes(key),
  ),
)
</script>
