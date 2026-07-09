import { useState, useEffect } from 'react'
import { parseEventId } from '../hooks/useGoogleCalendar'

export default function EventModal({ event, defaultDate, defaultTime, accounts, onClose, onSaved }) {
  const isEdit = !!event

  const [title,     setTitle]     = useState(event?.title || '')
  const [date,      setDate]      = useState(event?.date  || defaultDate || '')
  const [startTime, setStart]     = useState(event?.time  || defaultTime || '09:00')
  const [endTime,   setEnd]       = useState(event?.endTime || bumpHour(event?.time || defaultTime || '09:00'))
  const [allDay,    setAllDay]    = useState(event?.allDay || false)
  const [accountKey, setAccount]  = useState(() => {
    if (isEdit) return parseEventId(event.id).storageKey
    return accounts.find(a => a.isSignedIn)?.key || accounts[0]?.key
  })
  const [calendarId, setCalId]    = useState(() => {
    if (isEdit) return parseEventId(event.id).calendarId
    return 'primary'
  })
  const [saving,  setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [err,     setErr]     = useState(null)

  const account = accounts.find(a => a.key === accountKey)

  function bumpHour(t) {
    if (!t) return '10:00'
    const [h, m] = t.split(':').map(Number)
    return `${String((h + 1) % 24).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }

  const handleSave = async () => {
    if (!title.trim()) { setErr('Title is required'); return }
    if (!account?.isSignedIn) { setErr('No connected account for this user'); return }
    setSaving(true); setErr(null)
    try {
      const data = { title: title.trim(), date, startTime, endTime, allDay }
      if (isEdit) {
        const { calendarId: calId, eventId } = parseEventId(event.id)
        await account.updateEvent(calId, eventId, data)
      } else {
        await account.createEvent(calendarId, data)
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

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const signedInAccounts = accounts.filter(a => a.isSignedIn)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Edit Event' : 'New Event'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <input
              className="modal-input modal-input--title"
              placeholder="Event title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <label className="modal-check-row">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
            All day
          </label>

          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">Date</label>
              <input type="date" className="modal-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {!allDay && (
            <div className="modal-row">
              <div className="modal-field">
                <label className="modal-label">Start</label>
                <input type="time" className="modal-input" value={startTime} onChange={e => setStart(e.target.value)} />
              </div>
              <div className="modal-field">
                <label className="modal-label">End</label>
                <input type="time" className="modal-input" value={endTime} onChange={e => setEnd(e.target.value)} />
              </div>
            </div>
          )}

          {signedInAccounts.length > 1 && !isEdit && (
            <div className="modal-field">
              <label className="modal-label">Calendar owner</label>
              <select className="modal-input" value={accountKey} onChange={e => setAccount(e.target.value)}>
                {signedInAccounts.map(a => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </div>
          )}

          {account?.calendarList?.length > 0 && !isEdit && (
            <div className="modal-field">
              <label className="modal-label">Calendar</label>
              <select className="modal-input" value={calendarId} onChange={e => setCalId(e.target.value)}>
                {account.calendarList.map(c => (
                  <option key={c.id} value={c.id}>{c.primary ? `${c.summary} (primary)` : c.summary}</option>
                ))}
              </select>
            </div>
          )}

          {err && <p className="modal-error">{err}</p>}
        </div>

        <div className="modal-footer">
          {isEdit && (
            <button className="modal-btn modal-btn--delete" onClick={handleDelete} disabled={deleting}>
              {deleting ? '…' : 'Delete'}
            </button>
          )}
          <div className="modal-footer-right">
            <button className="modal-btn modal-btn--cancel" onClick={onClose}>Cancel</button>
            <button className="modal-btn modal-btn--save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
