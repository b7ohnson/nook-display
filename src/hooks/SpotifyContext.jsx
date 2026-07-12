import { createContext, useContext } from 'react'
import { useSpotify } from './useSpotify'

const SpotifyContext = createContext(null)

export function SpotifyProvider({ children }) {
  const sp = useSpotify()
  return <SpotifyContext.Provider value={sp}>{children}</SpotifyContext.Provider>
}

export function useSpotifyContext() {
  const ctx = useContext(SpotifyContext)
  if (!ctx) throw new Error('useSpotifyContext must be used inside SpotifyProvider')
  return ctx
}
