import { useState, useEffect, useMemo } from 'react'
import { useToday } from '../hooks/useToday'
import { eventDates } from '../hooks/useGoogleCalendar'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function MiniCalendar({ events = [], legend = [], selectedDate, onSelectDate }) {
  const todayStr = useToday()
  const [ty, tm, td] = todayStr.split('-').map(Number)
  // Months away from the current month, so the view follows the calendar into
  // a new month instead of sitting on the one that was current at boot.
  const [monthOffset, setMonthOffset] = useState(0)
  useEffect(() => { setMonthOffset(0) }, [todayStr])

  const view  = new Date(ty, tm - 1 + monthOffset, 1)
  const year  = view.getFullYear()
  const month = view.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay    = new Date(year, month, 1).getDay()
  const monthLabel  = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Build dot map: day -> [color, ...]
  const dotMap = useMemo(() => {
    const map = {}
    events.forEach(e => {
      eventDates(e).forEach(ds => {
        const [y, m, d] = ds.split('-').map(Number)
        if (y === year && m - 1 === month) (map[d] ||= []).push(e.color || '#94a3b8')
      })
    })
    return map
  }, [events, year, month])

  const isToday    = d => d === td && month === tm - 1 && year === ty
  const isSelected = d => selectedDate && d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()

  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))

  return (
    <div className="mini-calendar">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => setMonthOffset(o => o - 1)} aria-label="Previous month">‹</button>
        <span className="cal-month-label">{monthLabel}</span>
        <button className="cal-nav-btn" onClick={() => setMonthOffset(o => o + 1)} aria-label="Next month">›</button>
      </div>

      <div className="cal-grid">
        {DAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="cal-cell" />
          const date = new Date(year, month, day)
          return (
            <button
              key={i}
              type="button"
              className={[
                'cal-cell',
                'cal-cell--active',
                isToday(day) ? 'cal-cell--today' : '',
                isSelected(day) && !isToday(day) ? 'cal-cell--selected' : '',
              ].join(' ')}
              aria-label={date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              aria-current={isToday(day) ? 'date' : undefined}
              aria-pressed={!!isSelected(day)}
              onClick={() => onSelectDate(date)}
            >
              <span className="cal-day-num">{day}</span>
              {dotMap[day] && (
                <div className="cal-dots">
                  {[...new Set(dotMap[day])].slice(0, 3).map((c, idx) => (
                    <span key={idx} className="cal-dot" style={{ background: c }} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {legend.length > 0 && (
        <div className="cal-legend">
          {legend.map(l => (
            <div key={l.name} className="legend-item">
              <span className="legend-dot" style={{ background: l.color }} />
              <span className="legend-name">{l.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
