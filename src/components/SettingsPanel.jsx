import { useEffect, useRef } from 'react'
import { IconX } from './Icons'

const TEXT_SIZES = [
  { key: 'small',   label: 'S',  desc: 'Small'       },
  { key: 'default', label: 'M',  desc: 'Default'     },
  { key: 'large',   label: 'L',  desc: 'Large'       },
  { key: 'xl',      label: 'XL', desc: 'Extra large' },
]

const FONT_STYLES = [
  { key: 'system', label: 'System', font: 'system-ui, sans-serif' },
  { key: 'serif',  label: 'Serif',  font: "Georgia, serif"        },
]

// The keys are what syncs to Firestore (skylight/settings.accent) and are
// kept as they were; the colours behind them are defined in App.css. 'blue'
// is the stored default, so it now means the brand slate blue.
const ACCENTS = [
  { key: 'blue',  label: 'Slate blue', color: '#3F7097' },
  { key: 'amber', label: 'Amber',      color: '#F0A500' },
  { key: 'green', label: 'Pine',       color: '#2F7350' },
  { key: 'slate', label: 'Night navy', color: '#2B4560' },
]

const PREVIEW_SIZES = { small: '0.72rem', default: '0.85rem', large: '0.95rem', xl: '1.05rem' }

export default function SettingsPanel({ open, onClose, settings, onUpdate }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="settings-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="settings-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Display settings"
      >
        <div className="settings-panel__header">
          <span className="settings-panel__title">Display</span>
          <button className="settings-panel__close" onClick={onClose} aria-label="Close settings"><IconX size={22} /></button>
        </div>

        <div className="settings-panel__body">

          {/* Text Size */}
          <section className="settings-section">
            <h3 className="settings-section__label">Text size</h3>
            <div className="settings-segment" role="group" aria-label="Text size">
              {TEXT_SIZES.map(s => (
                <button
                  key={s.key}
                  className={`settings-segment__btn${settings.textSize === s.key ? ' settings-segment__btn--active' : ''}`}
                  onClick={() => onUpdate('textSize', s.key)}
                  aria-label={s.desc}
                  aria-pressed={settings.textSize === s.key}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="settings-preview" style={{ fontSize: PREVIEW_SIZES[settings.textSize] }}>
              Dentist, Thursday 10:30. Pick up milk on the way home.
            </p>
          </section>

          {/* Font Style */}
          <section className="settings-section">
            <h3 className="settings-section__label">Typeface</h3>
            <div className="settings-font-options" role="group" aria-label="Font style">
              {FONT_STYLES.map(f => (
                <button
                  key={f.key}
                  className={`settings-font-btn${settings.fontStyle === f.key ? ' settings-font-btn--active' : ''}`}
                  onClick={() => onUpdate('fontStyle', f.key)}
                  aria-pressed={settings.fontStyle === f.key}
                >
                  <span className="settings-font-btn__preview" style={{ fontFamily: f.font }}>Aa</span>
                  <span className="settings-font-btn__label">{f.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Accent Color */}
          <section className="settings-section">
            <h3 className="settings-section__label">Accent color</h3>
            <div className="settings-accents" role="group" aria-label="Accent color">
              {ACCENTS.map(a => (
                <button
                  key={a.key}
                  className={`settings-accent-swatch${settings.accent === a.key ? ' settings-accent-swatch--active' : ''}`}
                  style={{ background: a.color }}
                  onClick={() => onUpdate('accent', a.key)}
                  aria-label={a.label}
                  aria-pressed={settings.accent === a.key}
                  title={a.label}
                />
              ))}
            </div>
          </section>

        </div>
      </div>
    </>
  )
}
