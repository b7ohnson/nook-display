import { useState } from 'react'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function MiniCalendar({ events = [], legend = [], selectedDate, onSelectDate }) {
  const [view, setView] = useState(new Date())
  const today = new Date()

  const year  = view.getFullYear()
  const month = view.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay    = new Date(year, month, 1).getDay()
  const monthLabel  = view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Build dot map: day -> [color, ...]
  const dotMap = {}
  events.forEach(e => {
    const [y, m, d] = e.date.split('-').map(Number)
    if (y === year && m - 1 === month) {
      if (!dotMap[d]) dotMap[d] = []
      dotMap[d].push(e.color || '#94a3b8')
    }
  })

  const isToday    = d => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  const isSelected = d => selectedDate && d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()

  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))

  return (
    <div className="mini-calendar">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => setView(new Date(year, month - 1))}>‹</button>
        <span className="cal-month-label">{monthLabel}</span>
        <button className="cal-nav-btn" onClick={() => setView(new Date(year, month + 1))}>›</button>
      </div>

      <div className="cal-grid">
        {DAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
        {cells.map((day, i) => (
          <div
            key={i}
            className={[
              'cal-cell',
              day ? 'cal-cell--active' : '',
              day && isToday(day) ? 'cal-cell--today' : '',
              day && isSelected(day) && !isToday(day) ? 'cal-cell--selected' : '',
            ].join(' ')}
            onClick={() => day && onSelectDate(new Date(year, month, day))}
          >
            {day && (
              <>
                <span className="cal-day-num">{day}</span>
                {dotMap[day] && (
                  <div className="cal-dots">
                    {[...new Set(dotMap[day])].slice(0, 3).map((c, idx) => (
                      <span key={idx} className="cal-dot" style={{ background: c }} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
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
