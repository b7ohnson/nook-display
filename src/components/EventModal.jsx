import { useState, useEffect } from 'react'
import { parseEventId } from '../hooks/useGoogleCalendar'

function bumpHour(t) {
  if (!t) return '10:00'
  const [h, m] = t.split(':').map(Number)
  // Stay on the same day: a new event tapped at 23:15 ends at 23:59, not 00:15.
  if (h >= 23) return '23:59'
  return `${String(h + 1).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

export default function EventModal({ event, defaultDate, defaultTime, defaultAllDay, accounts, onClose, onSaved }) {
  const isEdit = !!event
  const readOnly = isEdit && event.writable === false

  const initial = {
    title:     event?.title || '',
    date:      event?.date  || defaultDate || '',
    endDate:   event?.endDate || event?.date || defaultDate || '',
    startTime: event?.time  || defaultTime || '09:00',
    endTime:   event?.endTime || bumpHour(event?.time || defaultTime || '09:00'),
    allDay:    event ? !!event.allDay : !!defaultAllDay,
  }

  const [title,     setTitle]     = useState(initial.title)
  const [date,      setDateRaw]   = useState(initial.date)
  const [endDate,   setEndDate]   = useState(initial.endDate)
  const [startTime, setStart]     = useState(initial.startTime)
  const [endTime,   setEnd]       = useState(initial.endTime)
  const [allDay,    setAllDay]    = useState(initial.allDay)
  const [accountKey, setAccount]  = useState(() => {
    if (isEdit) return parseEventId(event.id).storageKey
    return accounts.find(a => a.isSignedIn)?.key || accounts[0]?.key
  })
  const [pickedCalId, setCalId]   = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [err,     setErr]     = useState(null)

  const account = accounts.find(a => a.key === accountKey)

  // Only calendars this account can write to are offered. The value is derived
  // so the select and the calendar the event is sent to can never disagree,
  // including after switching owner or before the list has loaded.
  const writableCals = (account?.calendarList || []).filter(c => c.writable)
  const calendarId = writableCals.some(c => c.id === pickedCalId)
    ? pickedCalId
    : (writableCals.find(c => c.primary) || writableCals[0])?.id || 'primary'

  const setDate = (next) => {
    if (endDate === date || endDate < next) setEndDate(next)
    setDateRaw(next)
  }

  const validate = () => {
    if (!title.trim()) return 'Title is required'
    if (!date) return 'Date is required'
    if (!account?.isSignedIn) return 'Reconnect this calendar before saving'
    const lastDay = endDate || date
    if (allDay) {
      if (lastDay < date) return 'End date must be on or after the start date'
    } else {
      if (!startTime || !endTime) return 'Start and end times are required'
      if (`${lastDay}T${endTime}` <= `${date}T${startTime}`) return 'End must be after the start'
    }
    return null
  }

  const handleSave = async () => {
    const problem = validate()
    if (problem) { setErr(problem); return }
    setSaving(true); setErr(null)
    try {
      const timing = { date, endDate: endDate || date, startTime, endTime, allDay }
      if (isEdit) {
        const { calendarId: calId, eventId } = parseEventId(event.id)
        // Send only what changed so nothing else on the event is touched.
        const changes = {}
        if (title.trim() !== initial.title) changes.title = title.trim()
        const timingChanged = ['date', 'endDate', 'startTime', 'endTime', 'allDay']
          .some(k => timing[k] !== initial[k])
        if (timingChanged) Object.assign(changes, timing)
        await account.updateEvent(calId, eventId, changes)
      } else {
        await account.createEvent(calendarId, { title: title.trim(), ...timing })
      }
      onSaved()
    } catch (e) {
      setErr(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this event?')) return
    setDeleting(true); setErr(null)
    try {
      const { calendarId: calId, eventId } = parseEventId(event.id)
      await account.deleteEvent(calId, eventId)
      onSaved()
    } catch (e) {
      setErr(e.message || 'Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  // Restore focus on unmount; save previously focused element
  useEffect(() => {
    const prev = document.activeElement
    return () => prev?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const signedInAccounts = accounts.filter(a => a.isSignedIn)

  const handleFocusTrap = (e) => {
    if (e.key !== 'Tab') return
    const focusable = e.currentTarget.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last?.focus() }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first?.focus() }
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        onKeyDown={handleFocusTrap}
      >
        <div className="modal-header">
          <h3 className="modal-title" id="event-modal-title">
            {readOnly ? 'Event' : isEdit ? 'Edit Event' : 'New Event'}
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <input
              className="modal-input modal-input--title"
              placeholder="Event title"
              aria-label="Event title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={readOnly}
              autoFocus={!readOnly}
            />
          </div>

          <label className="modal-check-row">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} disabled={readOnly} />
            All day
          </label>

          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label" htmlFor="evt-date">Starts</label>
              <input id="evt-date" type="date" className="modal-input" value={date} onChange={e => setDate(e.target.value)} disabled={readOnly} />
            </div>
            <div className="modal-field">
              <label className="modal-label" htmlFor="evt-end-date">Ends</label>
              <input id="evt-end-date" type="date" className="modal-input" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} disabled={readOnly} />
            </div>
          </div>

          {!allDay && (
            <div className="modal-row">
              <div className="modal-field">
                <label className="modal-label" htmlFor="evt-start">Start time</label>
                <input id="evt-start" type="time" className="modal-input" value={startTime} onChange={e => setStart(e.target.value)} disabled={readOnly} />
              </div>
              <div className="modal-field">
                <label className="modal-label" htmlFor="evt-end">End time</label>
                <input id="evt-end" type="time" className="modal-input" value={endTime} onChange={e => setEnd(e.target.value)} disabled={readOnly} />
              </div>
            </div>
          )}

          {signedInAccounts.length > 1 && !isEdit && (
            <div className="modal-field">
              <label className="modal-label" htmlFor="evt-owner">Calendar owner</label>
              <select id="evt-owner" className="modal-input" value={accountKey} onChange={e => setAccount(e.target.value)}>
                {signedInAccounts.map(a => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </div>
          )}

          {writableCals.length > 0 && !isEdit && (
            <div className="modal-field">
              <label className="modal-label" htmlFor="evt-cal">Calendar</label>
              <select id="evt-cal" className="modal-input" value={calendarId} onChange={e => setCalId(e.target.value)}>
                {writableCals.map(c => (
                  <option key={c.id} value={c.id}>{c.primary ? `${c.summary} (primary)` : c.summary}</option>
                ))}
              </select>
            </div>
          )}

          {readOnly && (
            <p className="modal-note">
              {event.label ? `"${event.label}" is a read-only calendar` : 'This calendar is read-only'} — the event can't be changed from here.
            </p>
          )}

          {err && <p className="modal-error" role="alert">{err}</p>}
        </div>

        <div className="modal-footer">
          {isEdit && !readOnly && (
            <button className="modal-btn modal-btn--delete" onClick={handleDelete} disabled={deleting || saving}>
              {deleting ? '…' : 'Delete'}
            </button>
          )}
          <div className="modal-footer-right">
            <button className="modal-btn modal-btn--cancel" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>
            {!readOnly && (
              <button className="modal-btn modal-btn--save" onClick={handleSave} disabled={saving || deleting}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
