<template>
  <DialogWrapper v-model="connectionDetailModalShow">
    <VueJsonPretty :data="infoConn" />
    <div class="mt-2 h-10 text-sm">
      <template v-if="details">
        {{ $t('connectionIP') }} {{ details?.ip }}
        <div class="flex gap-3">
          {{ details?.country }}
          {{ details?.asn_organization }}
          ( AS{{ details?.asn }} )
        </div>
      </template>
    </div>
  </DialogWrapper>
</template>

<script setup lang="ts">
import { getIPFromIpsbAPI, type GlobalIPType } from '@/api'
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import { useConnections } from '@/composables/connections'
import type { Connection } from '@/types'
import { ref, watch } from 'vue'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'

const { infoConn, connectionDetailModalShow } = useConnections()
const details = ref<GlobalIPType | null>(null)
const getIpFromConnection = (conn: Connection) => {
  return conn.metadata.remoteDestination || conn.metadata.destinationIP
}
const localIPv4Reg = /^(127\.|10\.|192\.18\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/
const localIPv6Reg = /^(fc00::|fd[0-9a-f]{2}:|fe80::)/

watch(
  () => infoConn.value,
  () => {
    if (!infoConn.value) {
      return
    }
    const newIP = getIpFromConnection(infoConn.value)

    if (!newIP || localIPv4Reg.test(newIP) || localIPv6Reg.test(newIP)) {
      details.value = null
      return
    }

    if (newIP !== details.value?.ip) {
      details.value = null
      getIPFromIpsbAPI(infoConn.value?.metadata.destinationIP).then((res) => {
        details.value = res
      })
    }
  },
)
</script>
