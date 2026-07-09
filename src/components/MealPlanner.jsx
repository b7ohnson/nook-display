import { useState } from 'react'
import { useMeals } from '../hooks/useMeals'

const SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch',     label: 'Lunch'     },
  { key: 'dinner',    label: 'Dinner'    },
]

function getWeekDays() {
  const days  = []
  const today = new Date()
  const dow   = today.getDay()
  const mon   = new Date(today)
  mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    const pad = n => String(n).padStart(2, '0')
    const str = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    days.push({
      date:    str,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum:  d.getDate(),
      month:   d.toLocaleDateString('en-US', { month: 'short' }),
      isToday: d.toDateString() === today.toDateString(),
    })
  }
  return days
}

function MealCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')

  const open  = () => { setDraft(value || ''); setEditing(true) }
  const close = () => setEditing(false)
  const commit = () => { onSave(draft.trim()); close() }

  if (editing) {
    return (
      <input
        className="meal-cell-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter')  commit()
          if (e.key === 'Escape') { setDraft(value || ''); close() }
        }}
        autoFocus
        placeholder="Add meal…"
      />
    )
  }

  return (
    <div className={`meal-cell ${value ? 'meal-cell--filled' : 'meal-cell--empty'}`} onClick={open}>
      {value || <span className="meal-add">+</span>}
    </div>
  )
}

export default function MealPlanner() {
  const { meals, synced, setMeal } = useMeals()
  const days = getWeekDays()

  return (
    <div className="meal-page">
      <div className="meal-page-header">
        <span className="meal-page-title">Meal Planner</span>
        <span className="meal-page-week">
          {days[0].month} {days[0].dayNum} – {days[6].month} {days[6].dayNum}
        </span>
        {synced && <span className="meal-sync-dot" title="Synced" />}
      </div>

      <div className="meal-grid">
        {/* Column headers */}
        <div className="meal-grid-corner" />
        {days.map(d => (
          <div key={d.date} className={`meal-col-head ${d.isToday ? 'meal-col-head--today' : ''}`}>
            <span className="meal-day-name">{d.dayName}</span>
            <span className="meal-day-num">{d.dayNum}</span>
          </div>
        ))}

        {/* Slot rows */}
        {SLOTS.map(slot => (
          <>
            <div key={slot.key + '-label'} className="meal-slot-label">{slot.label}</div>
            {days.map(d => (
              <MealCell
                key={d.date + slot.key}
                value={meals[d.date]?.[slot.key]}
                onSave={v => setMeal(d.date, slot.key, v)}
              />
            ))}
          </>
        ))}
      </div>
    </div>
  )
}
