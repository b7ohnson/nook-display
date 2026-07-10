import { useState } from 'react'
import { useGroceries } from '../hooks/useGroceries'

export default function GroceryList() {
  const { items, synced, error, add, toggle, remove, clearDone } = useGroceries()
  const [input, setInput] = useState('')

  const submit = () => {
    if (!input.trim()) return
    add(input)
    setInput('')
  }

  const doneCount = items.filter(i => i.done).length

  return (
    <div className="grocery">
      <div className="grocery-header">
        <span className="grocery-title">Groceries</span>
        <div className="grocery-meta">
          {doneCount > 0 && (
            <button className="grocery-clear" onClick={clearDone}>
              Clear {doneCount} ✓
            </button>
          )}
          <span className={synced ? 'grocery-sync-ok' : 'grocery-sync-error'}>
            {error ? '⚠ offline' : synced ? '● live' : '…'}
          </span>
        </div>
      </div>

      <div className="grocery-items">
        {items.length === 0 && (
          <p className="grocery-empty">Nothing on the list</p>
        )}
        {items.map(item => (
          <div key={item.id} className={`grocery-item ${item.done ? 'grocery-item--done' : ''}`}>
            <button
              className={`grocery-check ${item.done ? 'grocery-check--done' : ''}`}
              onClick={() => toggle(item.id)}
              aria-label={item.done ? `Mark ${item.name} as not done` : `Mark ${item.name} as done`}
            >
              {item.done ? '✓' : ''}
            </button>
            <span className="grocery-name">{item.name}</span>
            <button className="grocery-remove" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`}>✕</button>
          </div>
        ))}
      </div>

      <div className="grocery-add">
        <input
          className="grocery-input"
          placeholder="Add item…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <button className="grocery-add-btn" onClick={submit}>+</button>
      </div>
    </div>
  )
}
