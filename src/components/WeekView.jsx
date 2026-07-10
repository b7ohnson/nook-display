import { useState, useEffect, useRef, useMemo } from 'react'

const HOUR_START  = 6
const HOUR_END    = 23
const PX_PER_HOUR = 68
const GRID_HEIGHT = (HOUR_END - HOUR_START) * PX_PER_HOUR
const HOURS       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toMins(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function toY(t) {
  return ((toMins(t) - HOUR_START * 60) / 60) * PX_PER_HOUR
}

function toH(start, end) {
  const s = toMins(start || '00:00')
  const e = toMins(end || '') || s + 60
  return Math.max(((e - s) / 60) * PX_PER_HOUR, 24)
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtHour(h) {
  if (h === 12) return '12 PM'
  return h > 12 ? `${h - 12} PM` : `${h} AM`
}

function layoutDay(events) {
  if (!events.length) return []
  const sorted = [...events].sort((a, b) => toMins(a.time) - toMins(b.time))
  const cols = []
  const out  = sorted.map(e => {
    const s = toMins(e.time || '00:00')
    const en = toMins(e.endTime || '') || s + 60
    let c = cols.findIndex(end => end <= s)
    if (c === -1) c = cols.length
    cols[c] = en
    return { ...e, _col: c, _s: s, _e: en }
  })
  const n = cols.length
  return out.map(e => ({ ...e, _n: n }))
}

export default function WeekView({ events = [], focusDate, onSlotClick, onEventClick, onEventDrop }) {
  const [offset, setOffset] = useState(0)
  const [now, setNow]       = useState(new Date())
  const scrollRef           = useRef(null)
  const dragRef             = useRef(null)   // { event, grabOffsetY }
  const lastDropRef         = useRef(0)      // timestamp of last drop — suppresses click

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!focusDate) return
    const today = new Date(); today.setHours(0,0,0,0)
    const focus = new Date(focusDate); focus.setHours(0,0,0,0)
    const diff = Math.round((focus - today) / 86400000)
    setOffset(Math.floor((diff + today.getDay()) / 7))
  }, [focusDate])

  useEffect(() => {
    if (!scrollRef.current) return
    const target = offset === 0
      ? toY(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`) - 120
      : toY('08:00') - 40
    scrollRef.current.scrollTop = Math.max(0, target)
  }, [offset])

  const weekStart = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0)
    d.setDate(d.getDate() - d.getDay() + offset * 7)
    return d
  }, [offset])

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
    }), [weekStart])

  const todayStr = dateStr(new Date())
  const nowY     = toY(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`)

  const weekLabel = (() => {
    const s = days[0], e = days[6]
    const sm = s.toLocaleDateString('en-US', { month: 'short' })
    const em = e.toLocaleDateString('en-US', { month: 'short' })
    const yr = e.getFullYear()
    return sm === em
      ? `${sm} ${s.getDate()}–${e.getDate()}, ${yr}`
      : `${sm} ${s.getDate()} – ${em} ${e.getDate()}, ${yr}`
  })()

  const byDate = useMemo(() => {
    const map = {}
    days.forEach(d => { map[dateStr(d)] = { timed: [], allDay: [] } })
    events.forEach(e => {
      if (!map[e.date]) return
      if (e.allDay || !e.time) map[e.date].allDay.push(e)
      else map[e.date].timed.push(e)
    })
    return map
  }, [events, days])

  const hasAllDay = days.some(d => byDate[dateStr(d)]?.allDay.length > 0)

  // ── Drag handlers ──────────────────────────────
  const handleDragStart = (e, ev) => {
    ev.stopPropagation()
    dragRef.current = { event: e, grabOffsetY: ev.nativeEvent.offsetY }
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', e.id)
  }

  const handleDragOver = (ev) => {
    ev.preventDefault()
    ev.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (ds, ev) => {
    ev.preventDefault()
    if (!dragRef.current || !onEventDrop) return
    const { event: dragEvt, grabOffsetY } = dragRef.current
    dragRef.current = null
    lastDropRef.current = Date.now()

    const rect = ev.currentTarget.getBoundingClientRect()
    const y    = ev.clientY - rect.top - grabOffsetY
    const rawMins  = Math.round(((y / PX_PER_HOUR) * 60 + HOUR_START * 60) / 15) * 15
    const clampedMins = Math.max(HOUR_START * 60, Math.min((HOUR_END - 1) * 60, rawMins))
    const h = String(Math.floor(clampedMins / 60)).padStart(2,'0')
    const m = String(clampedMins % 60).padStart(2,'0')
    onEventDrop(dragEvt, ds, `${h}:${m}`)
  }

  return (
    <div className="wv">
      <div className="wv-nav">
        <button className="wv-nav-btn" onClick={() => setOffset(o => o - 1)}>‹</button>
        <span className="wv-week-label">{weekLabel}</span>
        <button className="wv-nav-btn" onClick={() => setOffset(o => o + 1)}>›</button>
        {offset !== 0 && (
          <button className="wv-today-btn" onClick={() => setOffset(0)}>Today</button>
        )}
      </div>

      <div className="wv-header">
        <div className="wv-gutter" />
        {days.map((d, i) => {
          const isToday = dateStr(d) === todayStr
          return (
            <div key={i} className={`wv-day-hdr ${isToday ? 'wv-day-hdr--today' : ''}`}>
              <span className="wv-day-name">{DAY_NAMES[d.getDay()]}</span>
              <span className={`wv-day-num ${isToday ? 'wv-day-num--today' : ''}`}>{d.getDate()}</span>
            </div>
          )
        })}
      </div>

      {hasAllDay && (
        <div className="wv-allday-row">
          <div className="wv-gutter wv-allday-label">all‑day</div>
          {days.map((d, i) => (
            <div key={i} className="wv-allday-col" onClick={() => onSlotClick?.(dateStr(d), null, true)}>
              {byDate[dateStr(d)]?.allDay.map(e => (
                <div key={e.id} className="wv-allday-evt"
                  style={{ background: e.color + 'CC', borderLeft: `3px solid ${e.color}`, color: '#fff' }}
                  onClick={ev => { ev.stopPropagation(); onEventClick?.(e) }}>
                  {e.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="wv-scroll" ref={scrollRef}>
        <div className="wv-grid" style={{ height: GRID_HEIGHT }}>
          <div className="wv-gutter wv-time-col">
            {HOURS.map(h => (
              <div key={h} className="wv-hour-lbl" style={{ top: (h - HOUR_START) * PX_PER_HOUR }}>
                {fmtHour(h)}
              </div>
            ))}
          </div>

          <div className="wv-days">
            {HOURS.map(h => (
              <div key={h}     className="wv-line"            style={{ top: (h - HOUR_START) * PX_PER_HOUR }} />
            ))}
            {HOURS.map(h => (
              <div key={h+'h'} className="wv-line wv-line--half" style={{ top: (h - HOUR_START) * PX_PER_HOUR + PX_PER_HOUR / 2 }} />
            ))}

            {days.map((d, i) => {
              const ds      = dateStr(d)
              const isToday = ds === todayStr
              const laid    = layoutDay(byDate[ds]?.timed || [])

              return (
                <div
                  key={i}
                  className={`wv-col ${isToday ? 'wv-col--today' : ''}`}
                  role="button"
                  tabIndex={0}
                  onDragOver={onEventDrop ? handleDragOver : undefined}
                  onDrop={onEventDrop ? ev => handleDrop(ds, ev) : undefined}
                  onClick={ev => {
                    if (!onSlotClick) return
                    if (Date.now() - lastDropRef.current < 300) return
                    const rect = ev.currentTarget.getBoundingClientRect()
                    const y    = ev.clientY - rect.top
                    const mins = Math.round((y / PX_PER_HOUR) * 60 + HOUR_START * 60)
                    const h    = String(Math.floor(mins / 60)).padStart(2,'0')
                    const m    = String(Math.round((mins % 60) / 15) * 15 % 60).padStart(2,'0')
                    onSlotClick(ds, `${h}:${m}`, false)
                  }}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      onSlotClick?.(ds, '09:00', false)
                    }
                  }}
                >
                  {isToday && nowY >= 0 && nowY <= GRID_HEIGHT && (
                    <div className="wv-now" style={{ top: nowY }}>
                      <div className="wv-now-dot" />
                    </div>
                  )}

                  {laid.map(e => {
                    const y = toY(e.time)
                    const h = toH(e.time, e.endTime)
                    if (y + h < 0 || y > GRID_HEIGHT) return null
                    return (
                      <div
                        key={e.id}
                        className="wv-evt"
                        role="button"
                        tabIndex={0}
                        aria-label={`${e.title}, ${e.date}`}
                        draggable={!!onEventDrop}
                        onDragStart={onEventDrop ? ev => handleDragStart(e, ev) : undefined}
                        onClick={ev => { ev.stopPropagation(); onEventClick?.(e) }}
                        onKeyDown={ev => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.stopPropagation()
                            ev.preventDefault()
                            onEventClick?.(e)
                          }
                        }}
                        style={{
                          top:    y,
                          height: h,
                          left:   `calc(${(e._col / e._n) * 100}% + 2px)`,
                          width:  `calc(${100 / e._n}% - 4px)`,
                          background:  e.color + 'CC',
                          borderLeft:  `3px solid ${e.color}`,
                        }}
                      >
                        <div className="wv-evt-title" style={{ color: '#fff' }}>{e.title}</div>
                        {h > 36 && (
                          <div className="wv-evt-time" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            {fmtTime(e.time)}{e.endTime ? ` – ${fmtTime(e.endTime)}` : ''}
                          </div>
                        )}
                        {e.label && h > 52 && (
                          <div className="wv-evt-label" style={{ color: 'rgba(255,255,255,0.75)' }}>{e.label}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
