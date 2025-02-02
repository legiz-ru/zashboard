<template>
  <dialog
    ref="modalRef"
    class="modal"
    @close="isOpen = false"
    @touchstart.stop
    @touchmove.stop
    @touchend.stop
  >
    <div class="modal-box relative overflow-hidden p-0">
      <form method="dialog">
        <button class="btn btn-circle btn-ghost btn-xs absolute right-1 top-1 z-10 outline-none">
          <XMarkIcon class="h-4 w-4" />
        </button>
      </form>
      <div class="max-h-[90vh] overflow-y-auto p-4 max-md:max-h-[70vh]">
        <slot></slot>
      </div>
    </div>
    <form
      method="dialog"
      class="modal-backdrop"
    >
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { ref, watch } from 'vue'

const modalRef = ref<HTMLDialogElement>()
const isOpen = defineModel<boolean>()

watch(isOpen, (value) => {
  if (value) {
    modalRef.value?.showModal()
  } else {
    modalRef.value?.close()
  }
})
</script>
