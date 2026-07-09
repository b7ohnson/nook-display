import { useState, useEffect } from 'react'
import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export function useLeaderboard(game, timeRange = 'all') {
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!game) return
    let cancelled = false

    async function fetch() {
      setLoading(true)
      let q = query(
        collection(db, 'scores'),
        where('game', '==', game),
        orderBy('score', 'desc'),
        limit(10)
      )
      try {
        const snap = await getDocs(q)
        if (!cancelled) {
          let entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          if (timeRange !== 'all') {
            const cutoff = timeRange === 'today'
              ? new Date().setHours(0, 0, 0, 0)
              : Date.now() - 7 * 86400000
            entries = entries.filter(e => e.timestamp?.toMillis?.() >= cutoff)
          }
          setScores(entries)
        }
      } catch { if (!cancelled) setScores([]) }
      finally { if (!cancelled) setLoading(false) }
    }

    fetch()
    return () => { cancelled = true }
  }, [game, timeRange])

  const addScore = async ({ playerName, score }) => {
    if (!game || !playerName || score == null) return
    await addDoc(collection(db, 'scores'), {
      game, playerName, score, timestamp: serverTimestamp(),
    })
  }

  return { scores, loading, addScore }
}
