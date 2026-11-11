import { useMemo } from 'react'
import { useTasks } from '../hooks/useTasks'
import { useToday } from '../hooks/useToday'
import { addDays, eventDates } from '../hooks/useGoogleCalendar'

function fmtTime(t) {
  if (!t) return 'All day'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function RemindersPanel({ events = [] }) {
  const { tasks, synced, toggle } = useTasks()

  const today    = useToday()
  const tomorrow = addDays(today, 1)

  // Multi-day events count on every day they cover; only the first day has a
  // meaningful start time.
  const onDay = (day) => events
    .filter(e => eventDates(e).includes(day))
    .map(e => (e.date === day ? e : { ...e, time: null }))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  const todayEvts = useMemo(() =>
    onDay(today),
    [events, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const tomorrowEvts = useMemo(() =>
    onDay(tomorrow).slice(0, 3),
    [events, tomorrow]) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingTasks = useMemo(() => [
    ...(tasks.blessing || []).filter(t => !t.done).map(t => ({ ...t, who: 'Blessing', memberId: 'blessing' })),
    ...(tasks.pearl    || []).filter(t => !t.done).map(t => ({ ...t, who: 'Pearl',    memberId: 'pearl'    })),
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
              <button
                className="reminder-task-toggle"
                onClick={() => toggle(t.memberId, t.id)}
                disabled={!synced}
                aria-label={`Mark "${t.task}" complete`}
              />
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
