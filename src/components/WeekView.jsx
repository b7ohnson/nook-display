import { useState, useEffect, useRef, useMemo } from 'react'
import { useToday } from '../hooks/useToday'
import { eventDates } from '../hooks/useGoogleCalendar'

const PX_PER_HOUR = 68
const DAY_MINS    = 24 * 60
const GRID_HEIGHT = 24 * PX_PER_HOUR
const HOURS       = Array.from({ length: 24 }, (_, i) => i)
const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MIN_EVT_PX  = 24
const MIN_EVT_MINS = Math.ceil((MIN_EVT_PX / PX_PER_HOUR) * 60)
// How long the grid is left where someone scrolled it before it drifts back
// to the current time.
const RESCROLL_AFTER_MS = 2 * 60 * 1000

const pad = n => String(n).padStart(2, '0')

function toMins(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const minsToY = mins => (mins / 60) * PX_PER_HOUR
const minsToTime = mins => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`

function dateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtHour(h) {
  return `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`
}

// Calendar colours come from Google and range from near-black to pale yellow,
// so the text colour has to follow the background.
function textOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#fff'
  const n = parseInt(m[1], 16)
  const lin = c => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return L > 0.4 ? '#1f2937' : '#fff'
}

// The part of a timed event that falls inside one local day, in minutes from
// that day's midnight. Events crossing midnight yield a segment on each day.
function segmentFor(e, day) {
  let s, en
  if (e.startMs != null && e.endMs != null) {
    const dayStart = day.getTime()
    const dayEnd   = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
    if (e.endMs <= dayStart && e.startMs < dayStart) return null
    if (e.startMs >= dayEnd) return null
    s  = Math.max(0, Math.round((e.startMs - dayStart) / 60000))
    en = Math.min(DAY_MINS, Math.round((e.endMs - dayStart) / 60000))
  } else {
    if (e.date !== dateStr(day)) return null
    s  = toMins(e.time)
    en = e.endTime ? toMins(e.endTime) : s + 60
    if (en <= s) en = DAY_MINS
  }
  return { e, s, en, vEnd: Math.max(en, s + MIN_EVT_MINS), first: e.date === dateStr(day) }
}

// Columns are assigned per cluster of mutually overlapping events, so one
// clash at 9am does not halve the width of an unrelated event at 4pm.
function layoutDay(segs) {
  const sorted = [...segs].sort((a, b) => a.s - b.s || b.en - a.en)
  const out = []
  let cluster = [], cols = [], clusterEnd = -1
  const flush = () => {
    cluster.forEach(x => { x.n = cols.length })
    out.push(...cluster)
    cluster = []; cols = []; clusterEnd = -1
  }
  for (const seg of sorted) {
    if (cluster.length && seg.s >= clusterEnd) flush()
    let c = cols.findIndex(end => end <= seg.s)
    if (c === -1) c = cols.length
    cols[c] = seg.vEnd
    seg.col = c
    cluster.push(seg)
    clusterEnd = Math.max(clusterEnd, seg.vEnd)
  }
  flush()
  return out
}

export default function WeekView({ events = [], focusDate, onSlotClick, onEventClick, onEventDrop }) {
  const [offset, setOffset] = useState(0)
  const [now, setNow]       = useState(new Date())
  const todayStr            = useToday()
  const scrollRef           = useRef(null)
  const dragRef             = useRef(null)   // { event, grabOffsetY }
  const lastDropRef         = useRef(0)      // timestamp of last drop — suppresses click
  const lastTouchRef        = useRef(0)      // last time someone interacted with the grid

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

  const nowMins = now.getHours() * 60 + now.getMinutes()

  const scrollToDefault = () => {
    if (!scrollRef.current) return
    const target = offset === 0 ? minsToY(nowMins) - 120 : minsToY(8 * 60) - 40
    scrollRef.current.scrollTop = Math.max(0, target)
  }

  useEffect(scrollToDefault, [offset]) // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the clock through the day, but never yank the grid out from under
  // someone who is looking at another part of it.
  useEffect(() => {
    if (offset !== 0 || dragRef.current) return
    if (Date.now() - lastTouchRef.current < RESCROLL_AFTER_MS) return
    scrollToDefault()
  }, [now, todayStr]) // eslint-disable-line react-hooks/exhaustive-deps

  const markTouched = () => { lastTouchRef.current = Date.now() }

  const weekStart = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0)
    d.setDate(d.getDate() - d.getDay() + offset * 7)
    return d
    // todayStr: the week has to roll over at midnight on Saturday.
  }, [offset, todayStr]) // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
    }), [weekStart])

  const nowY = minsToY(nowMins)

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
      if (e.allDay || !e.time) {
        // Multi-day all-day events appear on every day they cover.
        eventDates(e).forEach(ds => map[ds]?.allDay.push(e))
        return
      }
      days.forEach(d => {
        const seg = segmentFor(e, d)
        if (seg) map[dateStr(d)].timed.push(seg)
      })
    })
    return map
  }, [events, days])

  const hasAllDay = days.some(d => byDate[dateStr(d)]?.allDay.length > 0)

  // ── Drag handlers ──────────────────────────────
  const handleDragStart = (e, ev) => {
    ev.stopPropagation()
    markTouched()
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
    const rawMins = Math.round(((y / PX_PER_HOUR) * 60) / 15) * 15
    onEventDrop(dragEvt, ds, minsToTime(Math.max(0, Math.min(DAY_MINS - 15, rawMins))))
  }

  return (
    <div className="wv">
      <div className="wv-nav">
        <button className="wv-nav-btn" onClick={() => setOffset(o => o - 1)} aria-label="Previous week">‹</button>
        <span className="wv-week-label">{weekLabel}</span>
        <button className="wv-nav-btn" onClick={() => setOffset(o => o + 1)} aria-label="Next week">›</button>
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
                <button key={e.id} type="button" className="wv-allday-evt"
                  style={{ background: e.color + 'CC', borderLeft: `3px solid ${e.color}`, color: textOn(e.color) }}
                  onClick={ev => { ev.stopPropagation(); onEventClick?.(e) }}>
                  {e.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div
        className="wv-scroll"
        ref={scrollRef}
        onPointerDown={markTouched}
        onTouchMove={markTouched}
        onWheel={markTouched}
        onKeyDown={markTouched}
      >
        <div className="wv-grid" style={{ height: GRID_HEIGHT }}>
          <div className="wv-gutter wv-time-col">
            {HOURS.map(h => (
              <div key={h} className="wv-hour-lbl" style={{ top: h * PX_PER_HOUR }}>
                {h === 0 ? '' : fmtHour(h)}
              </div>
            ))}
          </div>

          <div className="wv-days">
            {HOURS.map(h => (
              <div key={h}     className="wv-line"            style={{ top: h * PX_PER_HOUR }} />
            ))}
            {HOURS.map(h => (
              <div key={h+'h'} className="wv-line wv-line--half" style={{ top: h * PX_PER_HOUR + PX_PER_HOUR / 2 }} />
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
                  aria-label={`Add event on ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
                  onDragOver={onEventDrop ? handleDragOver : undefined}
                  onDrop={onEventDrop ? ev => handleDrop(ds, ev) : undefined}
                  onClick={ev => {
                    if (!onSlotClick) return
                    if (Date.now() - lastDropRef.current < 300) return
                    const rect = ev.currentTarget.getBoundingClientRect()
                    const y    = ev.clientY - rect.top
                    // Round the whole time, not just the minutes: 9:55 is 10:00.
                    const mins = Math.round(((y / PX_PER_HOUR) * 60) / 15) * 15
                    onSlotClick(ds, minsToTime(Math.max(0, Math.min(DAY_MINS - 15, mins))), false)
                  }}
                  onKeyDown={ev => {
                    if (ev.target !== ev.currentTarget) return
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      onSlotClick?.(ds, '09:00', false)
                    }
                  }}
                >
                  {isToday && (
                    <div className="wv-now" style={{ top: nowY }}>
                      <div className="wv-now-dot" />
                    </div>
                  )}

                  {laid.map(seg => {
                    const { e } = seg
                    const y = minsToY(seg.s)
                    const h = Math.max(minsToY(seg.en - seg.s), MIN_EVT_PX)
                    const fg = textOn(e.color)
                    const canDrag = !!onEventDrop && seg.first && e.writable !== false
                    return (
                      <div
                        key={e.id}
                        className="wv-evt"
                        role="button"
                        tabIndex={0}
                        aria-label={`${e.title}, ${e.date} ${fmtTime(e.time)}`}
                        draggable={canDrag}
                        onDragStart={canDrag ? ev => handleDragStart(e, ev) : undefined}
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
                          left:   `calc(${(seg.col / seg.n) * 100}% + 2px)`,
                          width:  `calc(${100 / seg.n}% - 4px)`,
                          background:  e.color + 'CC',
                          borderLeft:  `3px solid ${e.color}`,
                          color: fg,
                        }}
                      >
                        <div className="wv-evt-title" style={{ color: fg }}>{e.title}</div>
                        {h > 36 && (
                          <div className="wv-evt-time" style={{ color: fg, opacity: 0.85 }}>
                            {fmtTime(e.time)}{e.endTime ? ` – ${fmtTime(e.endTime)}` : ''}
                          </div>
                        )}
                        {e.label && h > 52 && (
                          <div className="wv-evt-label" style={{ color: fg, opacity: 0.75 }}>{e.label}</div>
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
