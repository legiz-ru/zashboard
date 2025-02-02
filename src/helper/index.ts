import { proxiesFilter } from '@/composables/proxies'
import { NOT_CONNECTED, PROXY_SORT_TYPE, PROXY_TYPE, ROUTE_NAME } from '@/config'
import { timeSaved } from '@/store/overview'
import { getLatencyByName, proxyMap } from '@/store/proxies'
import {
  hideUnavailableProxies,
  language,
  lowLatency,
  mediumLatency,
  proxySortType,
  sourceIPLabelMap,
  splitOverviewPage,
} from '@/store/settings'
import type { Backend, Connection } from '@/types'
import dayjs from 'dayjs'
import prettyBytes, { type Options } from 'pretty-bytes'
import { computed } from 'vue'

export const prettyBytesHelper = (bytes: number, opts?: Options) => {
  return prettyBytes(bytes, {
    binary: false,
    ...opts,
  })
}

export const fromNow = (timestamp: string) => {
  return dayjs(timestamp).locale(language.value).fromNow()
}

export const isProxyGroup = (name: string) => {
  const proxyNode = proxyMap.value[name]

  if (!proxyNode) {
    return false
  }

  return [
    PROXY_TYPE.Dns,
    PROXY_TYPE.Compatible,
    PROXY_TYPE.Direct,
    PROXY_TYPE.Reject,
    PROXY_TYPE.RejectDrop,
    PROXY_TYPE.Pass,
    PROXY_TYPE.Fallback,
    PROXY_TYPE.URLTest,
    PROXY_TYPE.LoadBalance,
    PROXY_TYPE.Selector,
  ].includes(proxyNode.type.toLowerCase() as PROXY_TYPE)
}

export const sortAndFilterProxyNodes = (proxies: string[], groupName?: string) => {
  const latencyMap = new Map<string, number>()
  const getLatencyForSort = (name: string) => {
    if (isProxyGroup(name)) {
      return -1
    }
    const latency = latencyMap.get(name)!

    return latency === 0 ? Infinity : latency
  }

  proxies = [...proxies]
  proxies.forEach((name) => {
    latencyMap.set(name, getLatencyByName(name, groupName))
  })

  if (hideUnavailableProxies.value) {
    proxies = proxies.filter((name) => {
      return isProxyGroup(name) || latencyMap.get(name)! > 0
    })
  }

  if (proxiesFilter.value) {
    proxies = proxies.filter((name) => {
      return name.toLowerCase().includes(proxiesFilter.value.toLowerCase())
    })
  }

  switch (proxySortType.value) {
    case PROXY_SORT_TYPE.DEFAULT:
      return proxies
    case PROXY_SORT_TYPE.NAME_ASC:
      return proxies.sort((prev, next) => prev.localeCompare(next))
    case PROXY_SORT_TYPE.NAME_DESC:
      return proxies.sort((prev, next) => next.localeCompare(prev))
    case PROXY_SORT_TYPE.LATENCY_ASC:
      return proxies.sort((prev, next) => getLatencyForSort(prev) - getLatencyForSort(next))
    case PROXY_SORT_TYPE.LATENCY_DESC:
      return proxies.sort((prev, next) => getLatencyForSort(next) - getLatencyForSort(prev))
  }
}

export const getIPLabelFromMap = (ip: string) => {
  if (ip === null) {
    return ''
  }
  if (ip === '') {
    return 'Inner'
  }
  const isIPv6 = ip.includes(':')

  for (const key in sourceIPLabelMap.value) {
    if (key.startsWith('/')) {
      const regex = new RegExp(key, 'i')

      if (regex.test(ip)) {
        return sourceIPLabelMap.value[key]
      }
    } else if (ip === key || (isIPv6 && ip.endsWith(key))) {
      return sourceIPLabelMap.value[key]
    }
  }
  return ip
}

export const getProcessFromConnection = (connection: Connection) => {
  return (
    connection.metadata.process ||
    connection.metadata.processPath.replace(/^.*[/\\](.*)$/, '$1') ||
    '-'
  )
}

export const getDestinationFromConnection = (connection: Connection) => {
  return (
    connection.metadata.remoteDestination ||
    connection.metadata.destinationIP ||
    connection.metadata.host
  )
}

export const getNetworkTypeFromConnection = (connection: Connection) => {
  return `${connection.metadata.type} | ${connection.metadata.network}`
}

export const getToolTipForParams = (
  params: ToolTipParams,
  config: {
    suffix: string
    binary: boolean
  },
) => {
  const { suffix = '', binary = false } = config

  // fake data
  if (params.data.name < timeSaved + 1) {
    return ``
  }
  return `
    <div class="flex items-center my-2 gap-1">
      <div class="w-4 h-4 rounded-full" style="background-color: ${params.color}"></div>
      ${params.seriesName}
      (${dayjs(params.data.name).format('HH:mm:ss')}): ${prettyBytesHelper(params.data.value, {
        binary: binary,
      })}${suffix}
    </div>`
}

export const exportSettings = () => {
  const settings: Record<string, string | null> = {}

  for (const key in localStorage) {
    if (key.startsWith('config/') || key.startsWith('setup/')) {
      settings[key] = localStorage.getItem(key)
    }
  }

  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'zashboard-settings'
  a.click()
  URL.revokeObjectURL(url)
}

export const getUrlFromBackend = (end: Omit<Backend, 'uuid'>) => {
  return `${end.protocol}://${end.host}:${end.port}${end.secondaryPath || ''}`
}

export const getColorForLatency = (latency: number) => {
  if (latency === NOT_CONNECTED) {
    return ''
  } else if (latency < lowLatency.value) {
    return 'text-green-500'
  } else if (latency < mediumLatency.value) {
    return 'text-yellow-500'
  } else {
    return 'text-red-500'
  }
}

export const renderRoutes = computed(() => {
  return Object.values(ROUTE_NAME).filter((r) => {
    return ![ROUTE_NAME.setup, !splitOverviewPage.value && ROUTE_NAME.overview].includes(r)
  })
})
