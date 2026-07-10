import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const TWO_HOURS = 2 * 60 * 60 * 1000

export function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function useGameRoom(roomCode) {
  const [room, setRoom]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [roomExpired, setRoomExpired] = useState(false)
  const seenRef                   = useRef(false)

  useEffect(() => {
    if (!roomCode) { setLoading(false); return }
    seenRef.current = false
    const ref = doc(db, 'gameRooms', roomCode)
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        const created = data.createdAt?.toMillis?.() || 0
        if (created && Date.now() - created > TWO_HOURS) {
          if (seenRef.current) setRoomExpired(true)
          setRoom(null)
        } else {
          seenRef.current = true
          setRoomExpired(false)
          setRoom(data)
        }
      } else {
        if (seenRef.current) setRoomExpired(true)
        setRoom(null)
      }
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [roomCode])

  const createRoom = async (game) => {
    if (!roomCode) return
    await setDoc(doc(db, 'gameRooms', roomCode), {
      code: roomCode,
      game,
      state: 'waiting',
      players: [],
      payload: {},
      createdAt: serverTimestamp(),
    })
  }

  const updateState = async (newState) => {
    if (!roomCode) return
    await updateDoc(doc(db, 'gameRooms', roomCode), { state: newState })
  }

  const updatePayload = async (updates) => {
    if (!roomCode) return
    const dotted = {}
    for (const [k, v] of Object.entries(updates)) dotted[`payload.${k}`] = v
    await updateDoc(doc(db, 'gameRooms', roomCode), dotted)
  }

  const addPlayer = async (player) => {
    if (!roomCode) return
    await updateDoc(doc(db, 'gameRooms', roomCode), { players: arrayUnion(player) })
  }

  const updatePlayerScore = async (playerId, score) => {
    if (!roomCode || !room) return
    const players = (room.players || []).map(p => p.id === playerId ? { ...p, score } : p)
    await updateDoc(doc(db, 'gameRooms', roomCode), { players })
  }

  const updatePlayer = async (playerId, updates) => {
    if (!roomCode || !room) return
    const players = (room.players || []).map(p => p.id === playerId ? { ...p, ...updates } : p)
    await updateDoc(doc(db, 'gameRooms', roomCode), { players })
  }

  const removeRoom = async () => {
    if (!roomCode) return
    await deleteDoc(doc(db, 'gameRooms', roomCode))
  }

  const created = room?.createdAt?.toMillis?.() || 0
  const expiringWarning = created > 0 && Date.now() - created > TWO_HOURS - 15 * 60 * 1000

  return {
    room,
    players: room?.players || [],
    payload: room?.payload || {},
    loading,
    roomExpired,
    expiringWarning,
    createRoom,
    updateState,
    updatePayload,
    addPlayer,
    updatePlayerScore,
    updatePlayer,
    removeRoom,
  }
}
