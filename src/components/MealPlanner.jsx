import { useState } from 'react'
import { useMeals } from '../hooks/useMeals'
import { IconChevronLeft, IconChevronRight } from './Icons'

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner']

// Weeks run Sunday to Saturday, the same as the calendar and chores.
function getWeekDays(offset = 0) {
  const days  = []
  const today = new Date()
  const sun   = new Date(today)
  sun.setDate(today.getDate() - today.getDay() + offset * 7)
  for (let i = 0; i < 7; i++) {
    const d = new Date(sun)
    d.setDate(sun.getDate() + i)
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
    if (weekOffset === 0)  return 'This week'
    if (weekOffset === 1)  return 'Next week'
    if (weekOffset === -1) return 'Last week'
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
          <h2 className="menu-title">Meals</h2>
        </div>
        <div className="menu-week-nav">
          <button className="menu-nav-btn" onClick={() => setWeekOffset(o => o - 1)} aria-label="Previous week"><IconChevronLeft size={22} /></button>
          <span className="menu-week-label" aria-live="polite">{weekLabel()}</span>
          <button className="menu-nav-btn" onClick={() => setWeekOffset(o => o + 1)} aria-label="Next week"><IconChevronRight size={22} /></button>
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
                        placeholder={type}
                      />
                    ) : (
                      <button
                        className={`menu-item-name${!saved ? ' menu-item-name--empty' : ''}`}
                        onClick={() => { setEditingKey(key); setEditValue(saved) }}
                        aria-label={saved ? `${day.label} ${type.toLowerCase()}: ${saved}. Edit` : `Add ${day.label} ${type.toLowerCase()}`}
                      >
                        {saved || 'Add'}
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
