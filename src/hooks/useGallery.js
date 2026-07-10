import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

const GAL_REF = doc(db, 'skylight', 'gallery')

export function useGallery() {
  const [photos, setPhotos]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(GAL_REF, snap => {
      setPhotos(snap.data()?.photos || [])
      setLoading(false)
    }, err => {
      console.error('Gallery snapshot error:', err)
      setPhotos([])
      setLoading(false)
    })
  }, [])

  return { photos, loading }
}
