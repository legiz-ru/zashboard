import { fetchRuleProvidersAPI, fetchRulesAPI } from '@/api'
import type { Rule, RuleProvider } from '@/types'
import { computed, ref } from 'vue'

export const rules = ref<Rule[]>([])
export const ruleProviderList = ref<RuleProvider[]>([])
export const rulesFilter = ref('')

export const renderRules = computed(() => {
  if (rulesFilter.value === '') {
    return rules.value
  }

  return rules.value.filter((rule) => {
    return [rule.type.toLowerCase(), rule.payload.toLowerCase(), rule.proxy.toLowerCase()].some(
      (i) => i.includes(rulesFilter.value.toLowerCase()),
    )
  })
})

export const renderRulesProvider = computed(() => {
  if (rulesFilter.value === '') {
    return ruleProviderList.value
  }

  return ruleProviderList.value.filter((ruleProvider) => {
    return [
      ruleProvider.name.toLowerCase(),
      ruleProvider.behavior.toLowerCase(),
      ruleProvider.vehicleType.toLowerCase(),
    ].some((i) => i.includes(rulesFilter.value.toLowerCase()))
  })
})

export const fetchRules = async () => {
  const { data: ruleData } = await fetchRulesAPI()
  const { data: providerData } = await fetchRuleProvidersAPI()

  rules.value = ruleData.rules.map((rule) => {
    const proxy = rule.proxy
    const proxyName = proxy.startsWith('route(') ? proxy.substring(6, proxy.length - 1) : proxy

    return {
      ...rule,
      proxy: proxyName,
    }
  })
  ruleProviderList.value = Object.values(providerData.providers)
}
