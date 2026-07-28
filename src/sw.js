import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// The display is wall-mounted and unattended, so a new build has to take over
// without anyone walking over to the TV.
//
// A top-level self.skipWaiting() alone was not enough: the freshly installed
// worker sat in `waiting` while the page kept running the previous bundle from
// the precache. main.jsx therefore drives the handoff explicitly through
// workbox-window, which posts SKIP_WAITING and reloads once the new worker
// takes control. The top-level call stays as a belt-and-braces fast path.
//
// Claiming clients means the running page keeps the JS it already loaded, which
// is safe today because every chunk is imported eagerly at boot. If tab content
// later moves behind React.lazy, revisit this: a lazily-loaded chunk requested
// after an update could 404 against the new precache.
self.skipWaiting()
clientsClaim()

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA fallback: any navigation offline still resolves to the cached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// Never cache anything auth- or data-bearing. Firestore keeps its own
// IndexedDB cache (see firebase.js) and handles offline itself; a stale
// Google Identity or Firestore response would be worse than no response.
registerRoute(
  ({ url }) =>
    url.hostname === 'accounts.google.com' ||
    url.hostname === 'apis.google.com' ||
    url.hostname === 'oauth2.googleapis.com' ||
    url.hostname === 'firestore.googleapis.com' ||
    url.hostname === 'identitytoolkit.googleapis.com' ||
    url.hostname.endsWith('.firebaseio.com') ||
    url.hostname === 'firebasestorage.googleapis.com' ||
    url.hostname === 'api.spotify.com' ||
    url.hostname === 'accounts.spotify.com',
  new NetworkOnly(),
)

// index.html pulls Inter from the Google Fonts CDN. Without this the display
// silently falls back to a system font whenever the network is down, which is
// visible from across the room.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'nook-google-fonts-css',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'nook-google-fonts-files',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
)

// News thumbnails, team logos and gallery photos come from many hosts. Holding
// the last few hundred keeps the Media tab and slideshow looking intact while
// offline instead of collapsing into broken-image icons. Capped so a
// long-running kiosk cannot grow this without bound.
registerRoute(
  ({ request, url }) => request.destination === 'image' && url.origin !== self.location.origin,
  new CacheFirst({
    cacheName: 'nook-remote-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 60 * 60 * 24 * 14,
        purgeOnQuotaError: true,
      }),
    ],
  }),
)
