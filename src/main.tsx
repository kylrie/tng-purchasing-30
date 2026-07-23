import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { isStaleDeployError, reloadForStaleDeployOnce, clearStaleDeployGuard } from './shared/utils/staleDeploy'

// Auto-recover from a STALE bundle after a deploy. A returning client can hold an
// old index.html (browser cache or PWA precache) that points at hashed chunks the
// new deploy already replaced; the failed load surfaces as a preload/chunk error.
// One guarded reload fetches the current (no-cache) shell + its chunks. See
// shared/utils/staleDeploy.ts. Registered before render so early failures are caught.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault() // suppress the default hard failure; recover instead
  reloadForStaleDeployOnce()
})
window.addEventListener('error', (event) => {
  if (isStaleDeployError(event.error ?? event.message)) reloadForStaleDeployOnce()
})
window.addEventListener('unhandledrejection', (event) => {
  if (isStaleDeployError(event.reason)) reloadForStaleDeployOnce()
})

// Register Service Worker for PWA (Offline Support)
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The shell mounted → the core bundle is current. Release the one-shot reload guard
// after a healthy interval so a LATER deploy in this session can auto-recover too.
window.setTimeout(clearStaleDeployGuard, 10000)
