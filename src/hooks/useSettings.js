import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const DOC_REF = () => doc(db, 'skylight', 'settings')

const DEFAULTS = {
  textSize:  'default', // 'small' | 'default' | 'large' | 'xl'
  fontStyle: 'system',  // 'system' | 'serif'
  accent:    'blue',    // 'blue' | 'amber' | 'green' | 'slate'
}

const TEXT_PX = { small: 14, default: 16, large: 18, xl: 20 }

const FONT_FAMILIES = {
  system: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  serif:  "Georgia, 'Times New Roman', serif",
}

function loadCached() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('nook_settings') || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(loadCached)
  const initial = useRef(settings)

  // Local cache is the instant-boot value; Firestore is the source of truth
  // once it loads, so settings follow the device even after localStorage is gone.
  useEffect(() => {
    const unsub = onSnapshot(
      DOC_REF(),
      (snap) => {
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, ...snap.data() }))
        } else {
          setDoc(DOC_REF(), initial.current).catch(() => {})
        }
      },
      () => {} // offline/error: keep using local cache
    )
    return unsub
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.fontSize = TEXT_PX[settings.textSize] + 'px'
    root.style.setProperty('--font', FONT_FAMILIES[settings.fontStyle])
    root.setAttribute('data-accent', settings.accent)
    localStorage.setItem('nook_settings', JSON.stringify(settings))
  }, [settings])

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setDoc(DOC_REF(), { [key]: value }, { merge: true }).catch(() => {})
  }

  return { settings, update }
}
