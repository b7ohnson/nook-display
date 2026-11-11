import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, runTransaction } from 'firebase/firestore'
import { GROCERIES } from 'nook-core/paths'
import { db } from '../firebase'
import { notify } from './useNotifications'

const REF = doc(db, ...GROCERIES)

function report(action) {
  return (err) => notify(navigator.onLine
    ? `Couldn't ${action}: ${err?.message || 'unknown error'}`
    : `Couldn't ${action} — the display is offline`)
}

export function useGroceries() {
  const [items, setItems]   = useState([])
  const [synced, setSynced] = useState(false)
  const [error, setError]   = useState(null)
  const itemsRef            = useRef([])

  useEffect(() => {
    const unsub = onSnapshot(REF,
      snap => {
        const latest = snap.data()?.items || []
        itemsRef.current = latest
        setItems(latest)
        setSynced(true)
        setError(null)
      },
      err => setError(err.message)
    )
    return unsub
  }, [])

  const add = (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const newItem = { id: Date.now(), name: trimmed, done: false }
    updateDoc(REF, { items: arrayUnion(newItem) }).catch(report(`add "${trimmed}"`))
  }

  const toggle = (id) =>
    runTransaction(db, async (txn) => {
      const snap = await txn.get(REF)
      const current = snap.data()?.items || []
      const updated = current.map(i => i.id === id ? { ...i, done: !i.done } : i)
      txn.update(REF, { items: updated })
    }).catch(report('update the list'))

  const remove = (id) => {
    const item = itemsRef.current.find(i => i.id === id)
    if (!item) return
    updateDoc(REF, { items: arrayRemove(item) }).catch(report(`remove "${item.name}"`))
  }

  const clearDone = () =>
    runTransaction(db, async (txn) => {
      const snap = await txn.get(REF)
      const current = snap.data()?.items || []
      txn.update(REF, { items: current.filter(i => !i.done) })
    }).catch(report('clear the list'))

  return { items, synced, error, add, toggle, remove, clearDone }
}
