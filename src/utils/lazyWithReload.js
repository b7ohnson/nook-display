import { lazy } from 'react'

const FLAG = 'nook-chunk-reload'

/**
 * React.lazy, hardened against a chunk that no longer exists.
 *
 * The display precaches its bundle in a service worker. When a deploy lands,
 * the new worker precaches the new chunks and cleanupOutdatedCaches drops the
 * old ones — but a page that was already open is still running the previous
 * build. The moment someone opens a tab whose chunk was only ever part of that
 * previous build, the dynamic import fails: the file is gone from the cache and
 * gone from Hosting too, since Firebase only serves the current release.
 *
 * A failed import in React.lazy surfaces as a render error, which on a wall
 * display means a tab that is simply dead until someone reboots the Pi. So on
 * an import failure, reload once to pick up the current build. The sessionStorage
 * flag makes it once per session: if the reload does not fix it, the error is
 * allowed through to the ErrorBoundary rather than looping.
 */
export function lazyWithReload(factory) {
  return lazy(() =>
    factory()
      .then((mod) => {
        sessionStorage.removeItem(FLAG)
        return mod
      })
      .catch((err) => {
        if (sessionStorage.getItem(FLAG)) throw err
        try { sessionStorage.setItem(FLAG, '1') } catch { throw err }
        window.location.reload()
        // Keep Suspense hanging while the reload happens; resolving or
        // rejecting here would flash an error a moment before the page goes.
        return new Promise(() => {})
      }),
  )
}
