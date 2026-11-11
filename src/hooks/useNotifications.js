import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { TASKS, GROCERIES } from 'nook-core/paths'
import { db } from '../firebase'

const TOAST_EVENT = 'nook-toast'

// Lets hooks and handlers anywhere raise a toast without threading a callback
// through props (the app has no context for this).
export function notify(message, type = 'error') {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }))
}

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

  useEffect(() => {
    const onToast = (e) => addToast(e.detail.message, e.detail.type)
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [addToast])

  // Watch tasks
  useEffect(() => {
    return onSnapshot(doc(db, ...TASKS), snap => {
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
      // Pending writes are this display's own edits: remember them, no toast.
      const own = snap.metadata.hasPendingWrites
      all.filter(t => !knownTasks.current.has(t.id)).forEach(t => {
        if (!own) addToast(`New task for ${t.who}: "${t.task}"`, 'task')
        knownTasks.current.add(t.id)
      })
    })
  }, [addToast])

  // Watch groceries
  useEffect(() => {
    return onSnapshot(doc(db, ...GROCERIES), snap => {
      const items = snap.exists() ? (snap.data().items || []) : []
      if (!grocInit.current) {
        items.forEach(i => knownGroc.current.add(i.id))
        grocInit.current = true
        return
      }
      const own = snap.metadata.hasPendingWrites
      items.filter(i => !knownGroc.current.has(i.id)).forEach(i => {
        if (!own) addToast(`Grocery added: "${i.name}"`, 'grocery')
        knownGroc.current.add(i.id)
      })
    })
  }, [addToast])

  return { toasts, dismiss }
}
