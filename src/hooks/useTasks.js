import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { initialChores } from '../data/mockData'

const DOC_REF = () => doc(db, 'skylight', 'tasks')

const RECURRENCE_MS = {
  daily:   1 * 24 * 60 * 60 * 1000,
  weekly:  7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

function resetElapsed(list) {
  const now = Date.now()
  return list.map(t => {
    if (!t.done || !t.recurrence || t.recurrence === 'none') return t
    const ms = RECURRENCE_MS[t.recurrence]
    if (ms && t.completedAt && now - t.completedAt >= ms) {
      return { ...t, done: false, completedAt: null }
    }
    return t
  })
}

export function useTasks() {
  const [tasks, setTasks]   = useState(initialChores)
  const [synced, setSynced] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      DOC_REF(),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          // Reset any recurring tasks whose interval has elapsed
          const reset = {}
          for (const [key, list] of Object.entries(data)) {
            reset[key] = Array.isArray(list) ? resetElapsed(list) : list
          }
          setTasks(reset)
          // Write back resets silently if anything changed
          const anyReset = Object.keys(reset).some(k =>
            JSON.stringify(reset[k]) !== JSON.stringify(data[k])
          )
          if (anyReset) setDoc(DOC_REF(), reset).catch(() => {})
        } else {
          setDoc(DOC_REF(), initialChores).catch(() => {})
        }
        setSynced(true)
      },
      (err) => {
        setError(err.message)
        setSynced(true)
      }
    )
    return unsub
  }, [])

  const save = (memberId, items) => {
    setTasks(prev => ({ ...prev, [memberId]: items }))
    setDoc(DOC_REF(), { [memberId]: items }, { merge: true }).catch(console.error)
  }

  const toggle = (memberId, id) => {
    const list = tasks[memberId] || []
    const updated = list.map(t => {
      if (t.id !== id) return t
      const nowDone = !t.done
      return { ...t, done: nowDone, completedAt: nowDone ? Date.now() : null }
    })
    save(memberId, updated)
  }

  const add = (memberId, text, recurrence = 'none') => {
    const trimmed = text.trim()
    if (!trimmed) return
    const item = { id: Date.now(), task: trimmed, done: false, recurrence, completedAt: null }
    save(memberId, [...(tasks[memberId] || []), item])
  }

  const remove = (memberId, id) => {
    save(memberId, (tasks[memberId] || []).filter(t => t.id !== id))
  }

  const clearArchive = (memberId) => {
    const active = (tasks[memberId] || []).filter(t => !t.done)
    save(memberId, active)
  }

  return { tasks, synced, error, toggle, add, remove, clearArchive }
}
