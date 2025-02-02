import { useEventBus } from '@vueuse/core'

export const collapsedBus = useEventBus<{ open: boolean }>('collapsedBus')
