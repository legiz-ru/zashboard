<template>
  <div class="flex items-center gap-1">
    <img
      :src="isSingBox ? SingBoxLogo : MetacubexLogo"
      class="h-4 w-4 rounded-xs"
    />
    {{ version }}
  </div>
</template>

<script setup lang="ts">
import { isSingBox, version } from '@/api'
import MetacubexLogo from '@/assets/metacubex.jpg'
import SingBoxLogo from '@/assets/sing-box.svg'
</script>
