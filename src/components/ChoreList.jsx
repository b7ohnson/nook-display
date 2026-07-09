import { useState, useRef } from 'react'
import { familyMembers } from '../data/mockData'
import { useTasks } from '../hooks/useTasks'

export default function ChoreList() {
  const [activeTab, setActiveTab] = useState(familyMembers[0].id)
  const [newTask, setNewTask]     = useState('')
  const inputRef                  = useRef(null)
  const { tasks, synced, error, toggle, add, remove } = useTasks()

  const activeMember = familyMembers.find(m => m.id === activeTab)
  const list = tasks[activeTab] || []
  const done = list.filter(c => c.done).length

  const handleAdd = () => {
    const text = newTask.trim()
    if (!text) return
    add(activeTab, text)
    setNewTask('')
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
          {done}/{list.length} done
        </span>
        {error && <span className="chore-sync-error" title={error}>⚠ offline</span>}
        {synced && !error && <span className="chore-sync-ok">● live</span>}
      </div>

      <div className="chore-items">
        {list.map(c => (
          <label key={c.id} className={`chore-item ${c.done ? 'chore-item--done' : ''}`}>
            <input
              type="checkbox"
              checked={c.done}
              onChange={() => toggle(activeTab, c.id)}
              style={{ accentColor: activeMember.color }}
            />
            <span className="chore-text">{c.task}</span>
            <button
              className="chore-remove"
              onClick={e => { e.preventDefault(); remove(activeTab, c.id) }}
              title="Remove"
            >×</button>
          </label>
        ))}

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
          <button
            className="chore-add-btn"
            style={{ background: activeMember.color }}
            onClick={handleAdd}
          >+</button>
        </div>
      </div>
    </div>
  )
}
