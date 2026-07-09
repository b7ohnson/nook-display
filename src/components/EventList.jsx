function fmtTime(time) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function dayLabel(dateStr, today) {
  const date = new Date(dateStr + 'T00:00:00')
  const diff  = Math.round((date - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function EventList({ events }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 14)

  const sorted = (events || [])
    .filter(e => {
      const d = new Date(e.date + 'T00:00:00')
      return d >= today && d <= limit
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      if (a.allDay && !b.allDay) return -1
      if (!a.allDay && b.allDay) return 1
      return (a.time || '').localeCompare(b.time || '')
    })

  const groups = []
  let cur = null
  sorted.forEach(e => {
    if (e.date !== cur) {
      cur = e.date
      groups.push({ date: e.date, label: dayLabel(e.date, today), events: [] })
    }
    groups.at(-1).events.push(e)
  })

  if (!groups.length) {
    return (
      <div className="event-list">
        <div className="section-title">Coming Up</div>
        <p className="empty-state">Nothing scheduled for the next two weeks ☀️</p>
      </div>
    )
  }

  return (
    <div className="event-list">
      <div className="section-title">Coming Up</div>
      {groups.map(g => (
        <div key={g.date} className="event-group">
          <div className="event-group-label">{g.label}</div>
          {g.events.map(e => (
            <div key={e.id} className="event-row">
              <div className="event-bar" style={{ background: e.color || '#CBD5E1' }} />
              <div className="event-body">
                <div className="event-title">{e.title}</div>
                <div className="event-meta">
                  {e.label && <span className="event-member" style={{ color: e.color || '#94a3b8' }}>{e.label}</span>}
                  {e.time && <span className="event-time">{fmtTime(e.time)}</span>}
                  {e.allDay && !e.time && <span className="event-time">All day</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
