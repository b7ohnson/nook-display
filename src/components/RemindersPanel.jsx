import { useMemo } from 'react'
import { useTasks } from '../hooks/useTasks'

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtTime(t) {
  if (!t) return 'All day'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function RemindersPanel({ events = [] }) {
  const { tasks } = useTasks()

  const today    = dateStr(new Date())
  const tomorrow = dateStr(new Date(Date.now() + 86400000))

  const todayEvts = useMemo(() =>
    events.filter(e => e.date === today).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [events, today])

  const tomorrowEvts = useMemo(() =>
    events.filter(e => e.date === tomorrow).sort((a, b) => (a.time || '').localeCompare(b.time || '')).slice(0, 3),
    [events, tomorrow])

  const pendingTasks = useMemo(() => [
    ...(tasks.blessing || []).filter(t => !t.done).map(t => ({ ...t, who: 'Blessing' })),
    ...(tasks.pearl    || []).filter(t => !t.done).map(t => ({ ...t, who: 'Pearl'    })),
  ].slice(0, 5), [tasks])

  const hasContent = todayEvts.length || tomorrowEvts.length || pendingTasks.length

  return (
    <div className="reminders">
      <div className="reminders-head">Reminders</div>

      {!hasContent && (
        <p className="reminders-empty">Nothing coming up</p>
      )}

      {todayEvts.length > 0 && (
        <div className="reminders-group">
          <div className="reminders-label">Today</div>
          {todayEvts.map(e => (
            <div key={e.id} className="reminder-row">
              <div className="reminder-dot" style={{ background: e.color }} />
              <div className="reminder-body">
                <div className="reminder-title">{e.title}</div>
                <div className="reminder-meta">{fmtTime(e.time)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tomorrowEvts.length > 0 && (
        <div className="reminders-group">
          <div className="reminders-label">Tomorrow</div>
          {tomorrowEvts.map(e => (
            <div key={e.id} className="reminder-row">
              <div className="reminder-dot" style={{ background: e.color }} />
              <div className="reminder-body">
                <div className="reminder-title">{e.title}</div>
                <div className="reminder-meta">{fmtTime(e.time)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingTasks.length > 0 && (
        <div className="reminders-group">
          <div className="reminders-label">Open Tasks</div>
          {pendingTasks.map(t => (
            <div key={t.id} className="reminder-row">
              <div className="reminder-dot reminder-dot--task" />
              <div className="reminder-body">
                <div className="reminder-title">{t.task}</div>
                <div className="reminder-meta">{t.who}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
