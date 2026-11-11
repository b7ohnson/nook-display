import { useState, useEffect, useCallback } from 'react'
import { doc, onSnapshot, runTransaction } from 'firebase/firestore'
import { resetElapsed } from 'nook-core/recurrence'
import { TASKS } from 'nook-core/paths'
import { db } from '../firebase'
import { initialChores } from '../data/mockData'
import { onDayChange } from './useToday'
import { notify } from './useNotifications'

const DOC_REF = () => doc(db, ...TASKS)

function resetAll(data) {
  const out = {}
  let changed = false
  for (const [key, list] of Object.entries(data)) {
    out[key] = Array.isArray(list) ? resetElapsed(list) : list
    if (Array.isArray(list) && out[key].some((t, i) => t !== list[i])) changed = true
  }
  return { out, changed }
}

// The tasks document is shared with every phone, so every write re-reads it
// inside a transaction and changes only the list it means to change. Writing
// back a whole snapshot (possibly a stale cached one) would drop chores added
// elsewhere in the meantime.
function updateList(memberId, fn) {
  return runTransaction(db, async (txn) => {
    const snap = await txn.get(DOC_REF())
    const current = snap.exists() ? (snap.data()[memberId] || []) : []
    const next = fn(current)
    if (next === current) return
    if (snap.exists()) txn.update(DOC_REF(), { [memberId]: next })
    else txn.set(DOC_REF(), { [memberId]: next })
  })
}

function applyResets() {
  return runTransaction(db, async (txn) => {
    const snap = await txn.get(DOC_REF())
    if (!snap.exists()) return
    const { out, changed } = resetAll(snap.data())
    if (changed) txn.update(DOC_REF(), out)
  })
}

export function useTasks() {
  const [tasks, setTasks]   = useState({})
  // True once the server has confirmed the document; input stays disabled
  // until then so nothing is built on an empty or cached guess.
  const [synced, setSynced] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      DOC_REF(),
      { includeMetadataChanges: true },
      (snap) => {
        const { fromCache, hasPendingWrites } = snap.metadata
        if (snap.exists()) {
          const data = snap.data()
          const { out, changed } = resetAll(data)
          setTasks(out)
          // Only write back from a server-confirmed view of the document.
          if (changed && !fromCache && !hasPendingWrites) applyResets().catch(() => {})
        } else if (!fromCache) {
          // Seed only when the server itself says there is no document; an
          // empty offline cache must never stand in for the real one.
          runTransaction(db, async (txn) => {
            const s = await txn.get(DOC_REF())
            if (!s.exists()) txn.set(DOC_REF(), initialChores)
          }).catch(() => {})
        }
        if (!fromCache) { setSynced(true); setError(null) }
      },
      (err) => setError(err.message)
    )
    return unsub
  }, [])

  // Recurring chores un-tick at local midnight even if no snapshot arrives.
  useEffect(() => onDayChange(() => { applyResets().catch(() => {}) }), [])

  const run = useCallback((p) => {
    p.catch(err => {
      notify(navigator.onLine
        ? `Couldn't save the chore change: ${err.message || 'unknown error'}`
        : "Couldn't save the chore change — the display is offline")
    })
  }, [])

  const toggle = useCallback((memberId, id) => run(updateList(memberId, list =>
    list.map(t => {
      if (t.id !== id) return t
      const nowDone = !t.done
      return { ...t, done: nowDone, completedAt: nowDone ? Date.now() : null }
    })
  )), [run])

  const add = useCallback((memberId, text, recurrence = 'none') => {
    const trimmed = text.trim()
    if (!trimmed) return
    const item = { id: Date.now(), task: trimmed, done: false, recurrence, completedAt: null }
    run(updateList(memberId, list => [...list, item]))
  }, [run])

  const remove = useCallback((memberId, id) =>
    run(updateList(memberId, list => list.filter(t => t.id !== id))), [run])

  const clearArchive = useCallback((memberId) =>
    run(updateList(memberId, list => list.filter(t => !t.done))), [run])

  return { tasks, synced, error, toggle, add, remove, clearArchive }
}
