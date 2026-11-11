import { IconCheckSquare, IconShoppingCart, IconBell, IconX } from './Icons'

const TYPE_META = {
  task:    { Icon: IconCheckSquare, color: 'var(--accent)' },
  grocery: { Icon: IconShoppingCart, color: 'var(--ok)' },
  info:    { Icon: IconBell,         color: 'var(--warn)' },
  error:   { Icon: IconBell,         color: 'var(--danger)' },
}

export default function ToastNotifications({ toasts, dismiss }) {
  if (!toasts.length) return null
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map(t => {
        const { Icon, color } = TYPE_META[t.type] || TYPE_META.info
        return (
          <div key={t.id} className="toast" style={{ '--toast-accent': color }}>
            <span className="toast-icon" style={{ color }}><Icon size={14} /></span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><IconX size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}
