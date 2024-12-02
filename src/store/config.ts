import { getConfigsAPI, patchConfigsAPI } from '@/api'
import {
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  LANG,
  PROXY_SORT_TYPE,
  PROXY_TAB_TYPE,
  RULE_TAB_TYPE,
} from '@/config'
import type { Config } from '@/types'
import { useStorage } from '@vueuse/core'
import { ref } from 'vue'

// global
export const theme = useStorage<string>('config/theme', 'default')
export const language = useStorage<LANG>('config/language', LANG.EN_US)
export const isSiderbarCollapsed = useStorage(
  'config/is-sidebar-collapsed',
  window.screen.width > 720,
)

// proxies
export const showGlobalProxy = useStorage('config/show-global-proxy', true)
export const collapseGroupMap = useStorage<Record<string, boolean>>('config/collapse-group-map', {})
export const twoColumns = useStorage('config/two-columns', true)
export const speedtestUrl = useStorage<string>(
  'config/speedtest-url',
  'http://www.gstatic.com/generate_204',
)
export const speedtestTimeout = useStorage<number>('config/speedtest-timeout', 5000)
export const proxySortType = useStorage<PROXY_SORT_TYPE>(
  'config/proxy-sort-type',
  PROXY_SORT_TYPE.DEFAULT,
)
export const proxiesTabShow = ref(PROXY_TAB_TYPE.PROXIES)
export const automaticDisconnection = useStorage('config/automatic-disconnection', true)
export const twoColumnsForProxyGroupInMobile = useStorage(
  'config/two-columns-for-proxy-group-in-mobile',
  false,
)
// connections
export const useConnectionCard = useStorage('config/use-connecticon-card', false)
export const connectionTableColumns = useStorage<CONNECTIONS_TABLE_ACCESSOR_KEY[]>(
  'config/connection-table-columns',
  [
    CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Host,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Type,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Rule,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
    CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
    CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed,
    CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime,
  ],
)
export const compactConnectionCard = useStorage<boolean>('config/compact-connection-card', true)
export const hostLabelMap = useStorage<Record<string, string>>('config/host-label-map', {})

// rules
export const rulesTabShow = ref(RULE_TAB_TYPE.RULES)

// configs
export const configs = ref<Config>()
export const fetchConfigs = async () => {
  configs.value = (await getConfigsAPI()).data
}
export const updateConfigs = async (cfg: Record<string, string>) => {
  await patchConfigsAPI(cfg)
  fetchConfigs()
}
