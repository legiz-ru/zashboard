import {
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  FONTS,
  LANG,
  PROXY_CARD_SIZE,
  PROXY_CHAIN_DIRECTION,
  PROXY_PREVIEW_TYPE,
  PROXY_SORT_TYPE,
  TABLE_SIZE,
  TABLE_WIDTH_MODE,
} from '@/config'
import { isMiddleScreen } from '@/helper/utils'
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

// global
export const theme = useStorage<string>('config/theme', 'default')
export const language = useStorage<LANG>(
  'config/language',
  Object.values(LANG).includes(navigator.language as LANG)
    ? (navigator.language as LANG)
    : LANG.EN_US,
)
export const isSidebarCollapsedConfig = useStorage('config/is-sidebar-collapsed', true)
export const isSidebarCollapsed = computed({
  get: () => {
    if (isMiddleScreen.value) {
      return true
    }

    return isSidebarCollapsedConfig.value
  },
  set: (value) => {
    isSidebarCollapsedConfig.value = value
  },
})
export const font = useStorage<FONTS>('config/font', FONTS.MI_SANS)
export const customBackgroundURL = useStorage('config/custom-background-image', '')
export const dashboardTransparent = useStorage('config/dashboard-transparent', 90)
export const autoUpgrade = useStorage('config/auto-upgrade', false)
export const autoUpgradeCore = useStorage('config/auto-upgrade-core', false)
export const swipeInTabs = useStorage('config/swipe-in-tabs', false)

// overview
export const splitOverviewPage = useStorage('config/split-overview-page', false)
export const showIPAndConnectionInfo = useStorage('config/show-ip-and-connection-info', true)
export const autoIPCheck = useStorage('config/auto-ip-check', true)
export const autoConnectionCheck = useStorage('config/auto-connection-check', true)
export const showStatisticsWhenSidebarCollapsed = useStorage(
  'config/show-statistics-when-sidebar-collapsed',
  true,
)
// proxies
export const showGlobalProxy = useStorage('config/show-global-proxy', true)
export const collapseGroupMap = useStorage<Record<string, boolean>>('config/collapse-group-map', {})
export const twoColumnProxyGroup = useStorage('config/two-columns', true)
export const speedtestUrl = useStorage<string>(
  'config/speedtest-url',
  'http://www.gstatic.com/generate_204',
)
export const independentLatencyTest = useStorage('config/independent-latency-test', false)
export const speedtestTimeout = useStorage<number>('config/speedtest-timeout', 5000)
export const proxySortType = useStorage<PROXY_SORT_TYPE>(
  'config/proxy-sort-type',
  PROXY_SORT_TYPE.DEFAULT,
)
export const automaticDisconnection = useStorage('config/automatic-disconnection', true)
export const truncateProxyName = useStorage('config/truncate-proxy-name', true)
export const proxyPreviewType = useStorage('config/proxy-preview-type', PROXY_PREVIEW_TYPE.AUTO)
export const hideUnavailableProxies = useStorage('config/hide-unavailable-proxies', false)
export const lowLatency = useStorage('config/low-latency', 400)
export const mediumLatency = useStorage('config/medium-latency', 800)
export const IPv6test = useStorage('config/ipv6-test', false)
export const proxyCardSize = useStorage<PROXY_CARD_SIZE>(
  'config/proxy-card-size',
  PROXY_CARD_SIZE.LARGE,
)
export const showHiddenGroup = useStorage('config/show-hidden-group', false)
export const iconSize = useStorage('config/icon-size', 14)
export const iconMarginRight = useStorage('config/icon-margin-right', 6)

// connections
export const useConnectionCard = useStorage('config/use-connecticon-card', window.innerWidth < 640)
export const proxyChainDirection = useStorage(
  'config/proxy-chain-direction',
  PROXY_CHAIN_DIRECTION.NORMAL,
)
export const tableSize = useStorage<TABLE_SIZE>('config/connecticon-table-size', TABLE_SIZE.SMALL)
export const tableWidthMode = useStorage('config/table-width-mode', TABLE_WIDTH_MODE.AUTO)
export const connectionTableColumns = useStorage<CONNECTIONS_TABLE_ACCESSOR_KEY[]>(
  'config/connection-table-columns',
  [
    CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Host,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Type,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Rule,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
    CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
    CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
    CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime,
  ],
)
export const connectionCardLines = useStorage<CONNECTIONS_TABLE_ACCESSOR_KEY[][]>(
  'config/connection-card-lines',
  [
    [CONNECTIONS_TABLE_ACCESSOR_KEY.Host, CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime],
    [
      CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
      CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
      CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
    ],
  ],
)
export const sourceIPLabelMap = useStorage<Record<string, string>>('config/source-ip-label-map', {})

// logs
export const logRetentionLimit = useStorage<number>('config/log-retention-limit', 1000)
