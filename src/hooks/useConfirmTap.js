import { useState, useRef, useEffect, useCallback } from 'react'

// Two-tap confirm for destructive buttons on a wall a child can reach: the
// first tap arms the button for a few seconds, the second one runs the action.
export function useConfirmTap(action, ms = 4000) {
  const [armed, setArmed] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const tap = useCallback(() => {
    clearTimeout(timer.current)
    if (armed) {
      setArmed(false)
      action()
    } else {
      setArmed(true)
      timer.current = setTimeout(() => setArmed(false), ms)
    }
  }, [armed, action, ms])

  return [armed, tap]
}
