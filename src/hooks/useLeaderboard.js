import { useState, useEffect } from 'react'
import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export function useLeaderboard(game, timeRange = 'all') {
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  // null, or { code, message }. 'failed-precondition' means the composite
  // index for the Today / This Week queries is missing (see report below).
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!game) return
    let cancelled = false

    async function fetch() {
      setLoading(true)
      setError(null)
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
      } catch (err) {
        if (cancelled) return
        if (err?.code === 'failed-precondition') {
          // Firestore's message includes a console link that creates the index.
          console.error('[NooK] Leaderboard query needs a composite index on scores (game ASC, score DESC, timestamp ASC):', err.message)
        }
        setScores([])
        setError({
          code: err?.code || 'unknown',
          message: err?.code === 'failed-precondition'
            ? 'Scores for this period need a database index that has not been created yet'
            : "Couldn't load scores",
        })
      }
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

  return { scores, loading, error, addScore }
}
