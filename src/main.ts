import '@/api/http'
import '@/helper/dayjs'
import 'tippy.js/animations/scale.css'
import 'tippy.js/dist/tippy.css'
import { createApp } from 'vue'
import App from './App.vue'
import { loadFonts } from './assets/load-fonts'
import './assets/main.css'
import { applyCustomThemes, applyKsuTheme } from './helper'
import { setupDesktopBackend } from './helper/desktop'
import { i18n } from './i18n'
import router from './router'

const isEdge = /Edg\//.test(navigator.userAgent)

if (isEdge) {
  const originalReplaceState = history.replaceState
  history.replaceState = function (...args) {
    if (document.visibilityState === 'hidden') return
    return originalReplaceState.apply(this, args)
  }
}

// Must run before the router is used: it redirects to the setup page whenever no
// backend is configured, and in the desktop build the bundled kernel is one.
setupDesktopBackend()

applyCustomThemes()
applyKsuTheme()
loadFonts()

const app = createApp(App)

app.use(router)
app.use(i18n)
app.mount('#app')
