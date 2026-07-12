import { useState } from 'react'
import { useMeals } from '../hooks/useMeals'

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner']

function getWeekDays(offset = 0) {
  const days  = []
  const today = new Date()
  const dow   = today.getDay()
  const mon   = new Date(today)
  mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    const pad = n => String(n).padStart(2, '0')
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    days.push({
      dateStr,
      label:     d.toLocaleDateString('en-US', { weekday: 'long' }),
      shortDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isToday:   d.toDateString() === today.toDateString(),
    })
  }
  return days
}

export default function MealPlanner() {
  const { meals, setMeal } = useMeals()
  const [weekOffset, setWeekOffset] = useState(0)
  const [editingKey, setEditingKey] = useState(null)
  const [editValue, setEditValue]   = useState('')

  const days = getWeekDays(weekOffset)

  function weekLabel() {
    if (weekOffset === 0)  return 'This Week'
    if (weekOffset === 1)  return 'Next Week'
    if (weekOffset === -1) return 'Last Week'
    return `${days[0].shortDate} – ${days[6].shortDate}`
  }

  function handleSave(key) {
    const date = key.slice(0, 10)
    const slot = key.slice(11)
    setMeal(date, slot, editValue.trim())
    setEditingKey(null)
    setEditValue('')
  }

  return (
    <div className="menu-page">
      <div className="menu-header">
        <div className="menu-title-row">
          <span className="menu-ornament">✦</span>
          <h2 className="menu-title">Weekly Menu</h2>
          <span className="menu-ornament">✦</span>
        </div>
        <div className="menu-week-nav">
          <button className="menu-nav-btn" onClick={() => setWeekOffset(o => o - 1)}>‹</button>
          <span className="menu-week-label">{weekLabel()}</span>
          <button className="menu-nav-btn" onClick={() => setWeekOffset(o => o + 1)}>›</button>
        </div>
      </div>

      <div className="menu-body">
        {days.map(day => (
          <div key={day.dateStr} className={`menu-day${day.isToday ? ' menu-day--today' : ''}`}>
            <div className="menu-day-header">
              <span className="menu-day-name">{day.label}</span>
              <span className="menu-day-date">{day.shortDate}</span>
            </div>
            <div className="menu-day-rule" />
            <div className="menu-day-items">
              {MEAL_TYPES.map(type => {
                const key = `${day.dateStr}-${type.toLowerCase()}`
                const saved = meals[day.dateStr]?.[type.toLowerCase()] || ''
                const isEditing = editingKey === key
                return (
                  <div key={type} className={`menu-item${isEditing ? ' menu-item--editing' : ''}`}>
                    <span className="menu-item-type">{type}</span>
                    {isEditing ? (
                      <input
                        className="menu-item-input"
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => handleSave(key)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSave(key)
                          if (e.key === 'Escape') { setEditingKey(null); setEditValue('') }
                        }}
                        placeholder={`Add ${type.toLowerCase()}…`}
                      />
                    ) : (
                      <button
                        className={`menu-item-name${!saved ? ' menu-item-name--empty' : ''}`}
                        onClick={() => { setEditingKey(key); setEditValue(saved) }}
                      >
                        {saved || '— add —'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
