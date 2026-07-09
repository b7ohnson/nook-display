import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useNotifications() {
  const [toasts, setToasts] = useState([])
  const tasksInit  = useRef(false)
  const grocInit   = useRef(false)
  const knownTasks = useRef(new Set())
  const knownGroc  = useRef(new Set())

  const addToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev.slice(-4), { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])

  // Watch tasks
  useEffect(() => {
    return onSnapshot(doc(db, 'skylight', 'tasks'), snap => {
      const data = snap.exists() ? snap.data() : {}
      const all  = [
        ...(data.blessing || []).map(t => ({ ...t, who: 'Blessing' })),
        ...(data.pearl    || []).map(t => ({ ...t, who: 'Pearl'    })),
      ]
      if (!tasksInit.current) {
        all.forEach(t => knownTasks.current.add(t.id))
        tasksInit.current = true
        return
      }
      all.filter(t => !knownTasks.current.has(t.id)).forEach(t => {
        addToast(`New task for ${t.who}: "${t.task}"`, 'task')
        knownTasks.current.add(t.id)
      })
    })
  }, [addToast])

  // Watch groceries
  useEffect(() => {
    return onSnapshot(doc(db, 'skylight', 'groceries'), snap => {
      const items = snap.exists() ? (snap.data().items || []) : []
      if (!grocInit.current) {
        items.forEach(i => knownGroc.current.add(i.id))
        grocInit.current = true
        return
      }
      items.filter(i => !knownGroc.current.has(i.id)).forEach(i => {
        addToast(`Grocery added: "${i.name}"`, 'grocery')
        knownGroc.current.add(i.id)
      })
    })
  }, [addToast])

  return { toasts, dismiss }
}
