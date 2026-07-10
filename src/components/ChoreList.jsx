import { useState, useRef } from 'react'
import { familyMembers } from '../data/mockData'
import { useTasks } from '../hooks/useTasks'
import { IconAlertTriangle } from './Icons'

const RECURRENCE_OPTS = [
  { value: 'none',    label: 'Once' },
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const RECUR_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

function nextReset(task) {
  if (!task.recurrence || task.recurrence === 'none' || !task.completedAt) return ''
  const MS = { daily: 86400000, weekly: 604800000, monthly: 2592000000 }
  const ms = MS[task.recurrence]
  if (!ms) return ''
  const diff = task.completedAt + ms - Date.now()
  if (diff <= 0) return 'resetting…'
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  return d >= 1 ? `resets in ${d}d` : `resets in ${h}h`
}

export default function ChoreList() {
  const [activeTab, setActiveTab]       = useState(familyMembers[0].id)
  const [newTask, setNewTask]           = useState('')
  const [recurrence, setRecurrence]     = useState('none')
  const [showArchive, setShowArchive]   = useState(false)
  const inputRef = useRef(null)

  const { tasks, synced, error, toggle, add, remove, clearArchive } = useTasks()

  const activeMember = familyMembers.find(m => m.id === activeTab)
  const list    = tasks[activeTab] || []
  const active  = list.filter(t => !t.done)
  const archive = list.filter(t => t.done)

  const handleAdd = () => {
    const text = newTask.trim()
    if (!text) return
    add(activeTab, text, recurrence)
    setNewTask('')
    setRecurrence('none')
    inputRef.current?.focus()
  }

  return (
    <div className="chore-list">
      <div className="chore-header">
        <span className="section-title" style={{ margin: 0 }}>Lists</span>
        <div className="chore-tabs">
          {familyMembers.map(m => (
            <button
              key={m.id}
              className={`chore-tab ${activeTab === m.id ? 'chore-tab--active' : ''}`}
              style={activeTab === m.id ? { borderColor: m.color, color: m.color, background: m.color + '18' } : {}}
              onClick={() => setActiveTab(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
        <span className="chore-progress" style={{ color: activeMember.color }}>
          {active.length} active
        </span>
        {error && <span className="chore-sync-error" title={error}><IconAlertTriangle size={12} /> offline</span>}
        {synced && !error && <span className="chore-sync-ok">● live</span>}
      </div>

      <div className="chore-items">
        {active.length === 0 && (
          <div className="chore-empty">All done!</div>
        )}

        {active.map(c => (
          <label key={c.id} className="chore-item">
            <input
              type="checkbox"
              checked={false}
              onChange={() => toggle(activeTab, c.id)}
              style={{ accentColor: activeMember.color }}
            />
            <span className="chore-text">
              {c.task}
              {c.recurrence && c.recurrence !== 'none' && (
                <span className="chore-recur-badge">{RECUR_LABEL[c.recurrence]}</span>
              )}
            </span>
            <button
              className="chore-remove"
              onClick={e => { e.preventDefault(); remove(activeTab, c.id) }}
              title="Remove"
            >×</button>
          </label>
        ))}

        {/* ── Add row ── */}
        <div className="chore-add">
          <input
            ref={inputRef}
            className="chore-input"
            type="text"
            placeholder={`Add task for ${activeMember.name}…`}
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="chore-recur-select">
            {RECURRENCE_OPTS.map(o => (
              <button
                key={o.value}
                className={`chore-recur-opt ${recurrence === o.value ? 'chore-recur-opt--active' : ''}`}
                style={recurrence === o.value ? { background: activeMember.color, color: '#fff', borderColor: activeMember.color } : {}}
                onClick={() => setRecurrence(o.value)}
                type="button"
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            className="chore-add-btn"
            style={{ background: activeMember.color }}
            onClick={handleAdd}
          >+</button>
        </div>

        {/* ── Archive ── */}
        {archive.length > 0 && (
          <div className="chore-archive">
            <button
              className="chore-archive-toggle"
              onClick={() => setShowArchive(v => !v)}
            >
              {showArchive ? '▾' : '▸'} Completed ({archive.length})
              {showArchive && (
                <span
                  className="chore-archive-clear"
                  onClick={e => { e.stopPropagation(); clearArchive(activeTab) }}
                >
                  Clear all
                </span>
              )}
            </button>
            {showArchive && (
              <div className="chore-archive-list">
                {archive.map(c => (
                  <div key={c.id} className="chore-item chore-item--done">
                    <span className="chore-check-done" style={{ color: activeMember.color }}>✓</span>
                    <span className="chore-text">
                      {c.task}
                      {c.recurrence && c.recurrence !== 'none' && (
                        <span className="chore-recur-badge chore-recur-badge--done">
                          {RECUR_LABEL[c.recurrence]} · {nextReset(c)}
                        </span>
                      )}
                    </span>
                    <button
                      className="chore-remove"
                      onClick={() => remove(activeTab, c.id)}
                      title="Remove from archive"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
