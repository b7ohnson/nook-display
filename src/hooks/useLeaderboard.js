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
      let cutoff
      if (timeRange === 'today') {
        cutoff = new Date()
        cutoff.setHours(0, 0, 0, 0)
      } else if (timeRange === 'week') {
        cutoff = new Date(Date.now() - 7 * 86400000)
      }
      const constraints = [
        where('game', '==', game),
        ...(cutoff ? [where('timestamp', '>=', cutoff)] : []),
        orderBy('score', 'desc'),
        limit(10),
      ]
      let q = query(collection(db, 'scores'), ...constraints)
      try {
        const snap = await getDocs(q)
        if (!cancelled) {
          const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
