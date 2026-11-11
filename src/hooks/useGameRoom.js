import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { ROOM_TTL_MS, ROOM_EXPIRY_WARNING_MS } from 'nook-core/constants'
import { gameRoom } from 'nook-core/paths'
import { db } from '../firebase'


export function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Every change to the `players` array goes through a transaction that re-reads
// the room first. Phones join and answer by writing the same array from the
// companion app, so writing back a local copy would erase a join or an answer
// that landed in between. `fn` receives the stored players and returns the new
// array; `extra` holds other fields (state, payload.*) to write in the same
// commit. Does nothing if the room has been deleted.
export async function mutateRoomPlayers(roomCode, fn, extra = {}) {
  if (!roomCode) return
  const ref = doc(db, ...gameRoom(roomCode))
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const current = Array.isArray(snap.data().players) ? snap.data().players : []
    tx.update(ref, { players: fn(current), ...extra })
  })
}

export function useGameRoom(roomCode) {
  const [room, setRoom]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [roomExpired, setRoomExpired] = useState(false)
  const seenRef                   = useRef(false)

  useEffect(() => {
    if (!roomCode) { setLoading(false); return }
    seenRef.current = false
    const ref = doc(db, ...gameRoom(roomCode))
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        const created = data.createdAt?.toMillis?.() || 0
        if (created && Date.now() - created > ROOM_TTL_MS) {
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
    await setDoc(doc(db, ...gameRoom(roomCode)), {
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
    await updateDoc(doc(db, ...gameRoom(roomCode)), { state: newState })
  }

  const updatePayload = async (updates) => {
    if (!roomCode) return
    const dotted = {}
    for (const [k, v] of Object.entries(updates)) dotted[`payload.${k}`] = v
    await updateDoc(doc(db, ...gameRoom(roomCode)), dotted)
  }

  const mutatePlayers = (fn, extra) => mutateRoomPlayers(roomCode, fn, extra)

  const addPlayer = (player) =>
    mutatePlayers(players => players.some(p => p.id === player.id) ? players : [...players, player])

  const updatePlayerScore = (playerId, score) =>
    mutatePlayers(players => players.map(p => p.id === playerId ? { ...p, score } : p))

  const updatePlayer = (playerId, updates) =>
    mutatePlayers(players => players.map(p => p.id === playerId ? { ...p, ...updates } : p))

  const removeRoom = async () => {
    if (!roomCode) return
    await deleteDoc(doc(db, ...gameRoom(roomCode)))
  }

  const created = room?.createdAt?.toMillis?.() || 0
  const expiringWarning = created > 0 && Date.now() - created > ROOM_TTL_MS - ROOM_EXPIRY_WARNING_MS

  return {
    room,
    players: room?.players || [],
    payload: room?.payload || {},
    loading,
    roomExpired,
    expiringWarning,
    createRoom,
    updateState,
    mutatePlayers,
    updatePayload,
    addPlayer,
    updatePlayerScore,
    updatePlayer,
    removeRoom,
  }
}
