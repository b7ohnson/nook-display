import { useState, useEffect } from 'react'

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

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('nook_settings') || '{}') }
    } catch {
      return { ...DEFAULTS }
    }
  })

  useEffect(() => {
    const root = document.documentElement
    root.style.fontSize = TEXT_PX[settings.textSize] + 'px'
    root.style.setProperty('--font', FONT_FAMILIES[settings.fontStyle])
    root.setAttribute('data-accent', settings.accent)
    localStorage.setItem('nook_settings', JSON.stringify(settings))
  }, [settings])

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))
  return { settings, update }
}
