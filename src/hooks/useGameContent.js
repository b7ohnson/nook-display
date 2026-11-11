import { useState, useEffect } from 'react'
import { collection, getDocs, setDoc, doc, query, where } from 'firebase/firestore'
import { GAME_CONTENT } from 'nook-core/paths'
import { db } from '../firebase'
import { RIDDLES, TRIVIA, WOULD_YOU_RATHER, HEADS_UP_WORDS } from '../data/gameContentSeed'

const SEED_MAP = {
  riddle:        RIDDLES.map(r => ({ type: 'riddle',        ...r })),
  trivia:        TRIVIA.map(t => ({ type: 'trivia',        ...t })),
  wouldYouRather: WOULD_YOU_RATHER.map(w => ({ type: 'wouldYouRather', ...w })),
  headsUpWord:   HEADS_UP_WORDS.map(h => ({ type: 'headsUpWord',   ...h })),
}

// Identity of a content item is its content, not its position in the seed or
// its document id, so a seed item already in Firestore (including copies
// written under random ids by the old addDoc seeding) is recognised.
function contentKey(item) {
  const { id, ...rest } = item // eslint-disable-line no-unused-vars
  return JSON.stringify(Object.keys(rest).sort().map(k => [k, rest[k]]))
}

function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0
  return h.toString(36)
}

const seedId = (item) => `seed-${item.type}-${hash(contentKey(item))}`

export function useGameContent(type) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!type) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const q = query(collection(db, GAME_CONTENT), where('type', '==', type))
      const snap = await getDocs(q)
      const existing = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      const have = new Set(existing.map(contentKey))
      const missing = (SEED_MAP[type] || []).filter(item => !have.has(contentKey(item)))
      if (!cancelled) {
        setItems([...existing, ...missing.map(item => ({ id: seedId(item), ...item }))])
        setLoading(false)
      }
      // Fire and forget: deterministic ids make a retried or concurrent seed
      // overwrite itself instead of adding duplicates, and the game does not
      // wait on writes that would hang while offline.
      missing.forEach(item => {
        setDoc(doc(db, GAME_CONTENT, seedId(item)), item).catch(() => {})
      })
    }

    load().catch(() => {
      // Firestore unavailable — fall back to seed data
      if (!cancelled) { setItems(SEED_MAP[type] || []); setLoading(false) }
    })

    return () => { cancelled = true }
  }, [type])

  return { items, loading }
}
