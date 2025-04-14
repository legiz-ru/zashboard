import tippy, { type Instance, type Props } from 'tippy.js'

let appContent: HTMLElement
let tippyInstance: Instance | null = null

export const useTooltip = () => {
  if (!appContent) {
    appContent = document.getElementById('app-content')!
  }

  const showTip = (event: Event, content: string | HTMLElement, config: Partial<Props> = {}) => {
    tippyInstance?.destroy()
    tippyInstance = tippy(event.target as HTMLElement, {
      content,
      placement: 'top',
      animation: 'scale',
      appendTo: appContent,
      allowHTML: true,
      showOnCreate: true,
      onHidden: () => {
        tippyInstance?.destroy()
        tippyInstance = null
      },
      ...config,
    })
  }

  const hideTip = () => {
    tippyInstance?.hide()
  }

  return {
    showTip,
    hideTip,
  }
}
