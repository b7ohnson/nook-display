import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { RIDDLES, TRIVIA, WOULD_YOU_RATHER, HEADS_UP_WORDS } from '../data/gameContentSeed'

const SEED_MAP = {
  riddle:        RIDDLES.map(r => ({ type: 'riddle',        ...r })),
  trivia:        TRIVIA.map(t => ({ type: 'trivia',        ...t })),
  wouldYouRather: WOULD_YOU_RATHER.map(w => ({ type: 'wouldYouRather', ...w })),
  headsUpWord:   HEADS_UP_WORDS.map(h => ({ type: 'headsUpWord',   ...h })),
}

export function useGameContent(type) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!type) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const q = query(collection(db, 'gameContent'), where('type', '==', type))
      const snap = await getDocs(q)

      const seed = SEED_MAP[type]
      if (seed && snap.size < seed.length) {
        // Seed or top-up: add items beyond current count (assumes seed order is stable)
        const toAdd = snap.empty ? seed : seed.slice(snap.size)
        await Promise.all(toAdd.map(item => addDoc(collection(db, 'gameContent'), item)))
        const existing = snap.empty ? [] : snap.docs.map(d => ({ id: d.id, ...d.data() }))
        if (!cancelled) setItems([...existing, ...toAdd])
      } else {
        if (!cancelled) setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      }
      if (!cancelled) setLoading(false)
    }

    load().catch(err => {
      // Firestore unavailable — fall back to seed data
      if (!cancelled) { setItems(SEED_MAP[type] || []); setLoading(false) }
    })

    return () => { cancelled = true }
  }, [type])

  return { items, loading }
}
