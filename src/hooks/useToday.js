import { useSyncExternalStore } from 'react'

// One shared day tick for everything that says "today". A wall display runs
// for days, so anything computed from new Date() at mount goes stale at
// midnight unless it re-renders then.
const pad = n => String(n).padStart(2, '0')
const key = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

let current = key()
let timer = null
const listeners = new Set()

function check() {
  const k = key()
  if (k !== current) {
    current = k
    listeners.forEach(fn => fn())
  }
}

function arm() {
  clearTimeout(timer)
  const next = new Date()
  next.setHours(24, 0, 1, 0)
  timer = setTimeout(() => { check(); arm() }, next - Date.now())
}

function subscribe(fn) {
  listeners.add(fn)
  if (listeners.size === 1) {
    check()
    arm()
    // Timers drift or pause if the Pi suspends or the clock is corrected.
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
  }
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0) {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }
}

/** Today's local date as YYYY-MM-DD; re-renders the caller at local midnight. */
export function useToday() {
  return useSyncExternalStore(subscribe, () => current)
}

/** Subscribe outside React (hooks that need to act at midnight). */
export function onDayChange(fn) {
  return subscribe(fn)
}
