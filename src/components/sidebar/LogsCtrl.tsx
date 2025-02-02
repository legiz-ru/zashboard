import { LOG_LEVEL } from '@/config'
import { isMiddleScreen } from '@/helper/utils'
import { initLogs, isPaused, logFilter, logLevel, logs } from '@/store/logs'
import { logRetentionLimit } from '@/store/settings'
import { PauseIcon, PlayIcon, WrenchScrewdriverIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { defineComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DialogWrapper from '../common/DialogWrapper.vue'
import TextInput from '../common/TextInput.vue'

export default defineComponent({
  props: {
    horizontal: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const { t } = useI18n()
    const settingsModel = ref(false)
    return () => {
      const levelSelect = (
        <select
          class={['join-item select select-bordered select-sm', !props.horizontal && 'w-full']}
          v-model={logLevel.value}
          onChange={initLogs}
        >
          {(Object.values(LOG_LEVEL) as string[]).map((opt) => (
            <option
              key={opt}
              value={opt}
            >
              {opt}
            </option>
          ))}
        </select>
      )
      const searchInput = (
        <TextInput
          v-model={logFilter.value}
          beforeClose={true}
          class="flex-1"
          placeholder={t('search')}
        />
      )

      const settingsModal = (
        <>
          <button
            class={'btn btn-circle btn-sm'}
            onClick={() => (settingsModel.value = true)}
          >
            <WrenchScrewdriverIcon class="h-4 w-4" />
          </button>
          <DialogWrapper v-model={settingsModel.value}>
            <div class="flex flex-col gap-4 p-2 text-sm">
              <div class="flex items-center gap-2">
                {t('logRetentionLimit')}
                <input
                  class="input input-sm input-bordered w-20"
                  type="number"
                  max="9999"
                  v-model={logRetentionLimit.value}
                />
              </div>
            </div>
          </DialogWrapper>
        </>
      )

      const buttons = (
        <>
          {settingsModal}
          <button
            class="btn btn-circle btn-sm"
            onClick={() => (isPaused.value = !isPaused.value)}
          >
            {isPaused.value ? <PlayIcon class="h-4 w-4" /> : <PauseIcon class="h-4 w-4" />}
          </button>
          <button
            class="btn btn-circle btn-sm"
            onClick={() => (logs.value = [])}
          >
            <XMarkIcon class="h-4 w-4" />
          </button>
        </>
      )

      if (props.horizontal) {
        return (
          <div class="flex items-center gap-2 p-2">
            <div class="join w-96">
              {levelSelect}
              {searchInput}
            </div>
            {!isMiddleScreen.value && <div class="flex-1"></div>}
            {buttons}
          </div>
        )
      }
      return (
        <div class="flex w-full flex-col items-center gap-2 p-2">
          <div class="flex w-full items-center gap-2">
            {levelSelect}
            {buttons}
          </div>
          <div class="w-full">{searchInput}</div>
        </div>
      )
    }
  },
})
