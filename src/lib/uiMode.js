import { useEffect, useState } from 'react'

// Which interface the user works in: the current one ("modern") or the
// Plus Yoghurt ERP look ("classic"). Remembered on this device.
const KEY = 'plusTreatUiView'
const EVENT = 'plustreat-ui-mode'

export function getUiMode() {
  try { return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'modern' } catch { return 'modern' }
}

export function setUiMode(mode) {
  try { localStorage.setItem(KEY, mode) } catch { /* private mode: keep for this session only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }))
}

export function useUiMode() {
  const [mode, setMode] = useState(getUiMode)
  useEffect(() => {
    const sync = () => setMode(getUiMode())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  useEffect(() => {
    document.body.classList.toggle('ui-classic', mode === 'classic')
  }, [mode])
  return [mode, setUiMode]
}
