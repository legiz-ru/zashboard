<template>
  <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
    <div class="flex items-center gap-2">
      <div>{{ $t('tableWidthMode') }}:</div>
      <select
        class="select select-bordered select-sm min-w-24"
        v-model="tableWidthMode"
      >
        <option
          v-for="opt in Object.values(TABLE_WIDTH_MODE)"
          :key="opt"
          :value="opt"
        >
          {{ $t(opt) }}
        </option>
      </select>
    </div>
    <div class="flex items-center gap-2">
      <div>{{ $t('tableSize') }}:</div>
      <select
        class="select select-bordered select-sm min-w-24"
        v-model="tableSize"
      >
        <option
          v-for="opt in Object.values(TABLE_SIZE)"
          :key="opt"
          :value="opt"
        >
          {{ $t(opt) }}
        </option>
      </select>
    </div>
  </div>
  <div>{{ $t('customTableColumns') }}:</div>
  <div class="flex rounded lg:flex-col">
    <Draggable
      class="flex flex-1 flex-col gap-2 bg-base-200 p-2 lg:flex-row"
      v-model="connectionTableColumns"
      group="list"
      :animation="150"
      :item-key="(id: string) => id"
      @start="disableSwipe = true"
      @end="disableSwipe = false"
    >
      <template #item="{ element }">
        <div
          class="flex h-8 cursor-move items-center rounded bg-neutral px-2 font-bold text-neutral-content"
        >
          {{ $t(element) }}
        </div>
      </template>
    </Draggable>
    <Draggable
      class="flex flex-1 flex-col gap-2 p-2 lg:flex-row"
      v-model="restOfColumns"
      group="list"
      :animation="150"
      :item-key="(id: string) => id"
      @start="disableSwipe = true"
      @end="disableSwipe = false"
    >
      <template #item="{ element }">
        <div class="flex h-8 cursor-move items-center rounded bg-neutral px-2 text-neutral-content">
          {{ $t(element) }}
        </div>
      </template>
    </Draggable>
  </div>
</template>

<script setup lang="ts">
import { disableSwipe } from '@/composables/swipe'
import { CONNECTIONS_TABLE_ACCESSOR_KEY, TABLE_SIZE, TABLE_WIDTH_MODE } from '@/config'
import { connectionTableColumns, tableSize, tableWidthMode } from '@/store/settings'
import { ref } from 'vue'
import Draggable from 'vuedraggable'

const restOfColumns = ref(
  Object.values(CONNECTIONS_TABLE_ACCESSOR_KEY).filter(
    (key) => !connectionTableColumns.value.includes(key),
  ),
)
</script>
