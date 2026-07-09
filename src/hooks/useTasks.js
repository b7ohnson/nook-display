import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { initialChores } from '../data/mockData'

const DOC_REF = () => doc(db, 'skylight', 'tasks')

export function useTasks() {
  const [tasks, setTasks]   = useState(initialChores)
  const [synced, setSynced] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      DOC_REF(),
      (snap) => {
        if (snap.exists()) {
          setTasks(snap.data())
        } else {
          // First run — seed Firestore with defaults
          setDoc(DOC_REF(), initialChores).catch(() => {})
        }
        setSynced(true)
      },
      (err) => {
        console.error('Firestore error:', err)
        setError(err.message)
        setSynced(true) // fall back to local state
      }
    )
    return unsub
  }, [])

  const updateMember = (memberId, items) => {
    setTasks(prev => ({ ...prev, [memberId]: items }))
    setDoc(DOC_REF(), { [memberId]: items }, { merge: true }).catch(console.error)
  }

  const toggle = (memberId, id) => {
    const updated = (tasks[memberId] || []).map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    )
    updateMember(memberId, updated)
  }

  const add = (memberId, text) => {
    const updated = [...(tasks[memberId] || []), { id: Date.now(), task: text, done: false }]
    updateMember(memberId, updated)
  }

  const remove = (memberId, id) => {
    const updated = (tasks[memberId] || []).filter(t => t.id !== id)
    updateMember(memberId, updated)
  }

  return { tasks, synced, error, toggle, add, remove }
}
