<template>
  <div
    v-if="visible"
    class="bg-base-300/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur"
  >
    <div class="card bg-base-100 flex w-full max-w-md flex-col gap-4 p-6 shadow-xl">
      <!-- 欢迎 -->
      <template v-if="step === 'welcome'">
        <h1 class="text-xl font-semibold">{{ $t('onboardingWelcomeTitle') }}</h1>
        <p class="text-base-content/70 text-sm">{{ $t('onboardingWelcomeBody') }}</p>
        <div class="flex justify-end gap-2">
          <button
            class="btn btn-ghost btn-sm"
            @click="dismiss"
          >
            {{ $t('onboardingSkip') }}
          </button>
          <button
            class="btn btn-primary btn-sm"
            @click="step = 'import'"
          >
            {{ $t('onboardingGetStarted') }}
          </button>
        </div>
      </template>

      <!-- 导入订阅 -->
      <template v-else-if="step === 'import'">
        <h1 class="text-xl font-semibold">{{ $t('onboardingImportTitle') }}</h1>
        <p class="text-base-content/70 text-sm">{{ $t('onboardingImportSubtitle') }}</p>
        <input
          v-model="url"
          class="input input-sm w-full"
          :placeholder="$t('subscriptionUrlPlaceholder')"
          @keyup.enter="handlerImport"
        />
        <div
          v-if="error"
          class="text-error text-xs break-all whitespace-pre-wrap"
        >
          {{ error }}
        </div>
        <div class="flex justify-between gap-2">
          <button
            class="btn btn-ghost btn-sm"
            @click="step = 'welcome'"
          >
            {{ $t('onboardingBack') }}
          </button>
          <div class="flex gap-2">
            <button
              class="btn btn-ghost btn-sm"
              @click="dismiss"
            >
              {{ $t('onboardingSkip') }}
            </button>
            <button
              class="btn btn-primary btn-sm"
              :disabled="busy || !url.trim()"
              @click="handlerImport"
            >
              <span
                v-if="busy"
                class="loading loading-spinner h-4 w-4"
              ></span>
              {{ $t('import') }}
            </button>
          </div>
        </div>
      </template>

      <!-- 系统代理 -->
      <template v-else-if="step === 'systemProxy'">
        <h1 class="text-xl font-semibold">{{ $t('onboardingSystemProxyTitle') }}</h1>
        <p class="text-base-content/70 text-sm">{{ $t('onboardingSystemProxyBody') }}</p>
        <div class="flex justify-end gap-2">
          <button
            class="btn btn-ghost btn-sm"
            @click="step = 'done'"
          >
            {{ $t('onboardingSkip') }}
          </button>
          <button
            class="btn btn-primary btn-sm"
            @click="handlerEnableSystemProxy"
          >
            {{ $t('enable') }}
          </button>
        </div>
      </template>

      <!-- 完成 -->
      <template v-else>
        <h1 class="text-xl font-semibold">{{ $t('onboardingDoneTitle') }}</h1>
        <p class="text-base-content/70 text-sm">{{ $t('onboardingDoneBody') }}</p>
        <div class="flex justify-end">
          <button
            class="btn btn-primary btn-sm"
            @click="finish"
          >
            {{ $t('onboardingGoToProxies') }}
          </button>
        </div>
      </template>

      <div class="text-base-content/50 text-center text-xs">
        {{ $t('onboardingStep', { current: stepIndex + 1, total: STEPS.length }) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  hasDesktopProfile,
  importProfileFromUrl,
  isDesktop,
  patchDesktopSettings,
} from '@/composables/desktop'
import { ROUTE_NAME } from '@/constant'
import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

type Step = 'welcome' | 'import' | 'systemProxy' | 'done'

const STEPS: Step[] = ['welcome', 'import', 'systemProxy', 'done']

const router = useRouter()
// Dismissing is permanent: the profiles page keeps the import flow reachable,
// so re-nagging on every launch would only be noise.
const dismissed = useStorage('config/desktop-onboarding-dismissed', false)
const step = ref<Step>('welcome')
const url = ref('')
const busy = ref(false)
const error = ref('')

// Only a desktop build with no profiles at all opens the wizard — an existing
// install goes straight to the dashboard.
const gate = computed(() => isDesktop && !dismissed.value && !hasDesktopProfile.value)
// Latched: a successful import flips the gate false, which would otherwise pull
// the overlay away before the system-proxy and done steps ever render. Only the
// gate opens it; only dismiss/finish closes it.
const open = ref(false)

watch(
  gate,
  (value) => {
    if (value) open.value = true
  },
  { immediate: true },
)

const visible = computed(() => open.value && !dismissed.value)
const stepIndex = computed(() => STEPS.indexOf(step.value))

const dismiss = () => {
  dismissed.value = true
}

const finish = () => {
  dismissed.value = true
  router.push({ name: ROUTE_NAME.proxies })
}

const handlerImport = async () => {
  const target = url.value.trim()

  if (!target || busy.value) return

  busy.value = true
  error.value = ''
  try {
    await importProfileFromUrl(target)
    step.value = 'systemProxy'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

const handlerEnableSystemProxy = async () => {
  await patchDesktopSettings({ systemProxy: true })
  step.value = 'done'
}
</script>
