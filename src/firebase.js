import { initializeApp } from 'firebase/app'
import {
  initializeFirestore, getFirestore,
  persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

// The display is wall-mounted and long-running, so a brief Wi-Fi drop should
// not empty the screen. An IndexedDB-backed cache lets onSnapshot serve the
// last known chores, groceries, meals and settings immediately on reload and
// keep serving them while offline, syncing when the connection returns.
//
// Persistence can legitimately be unavailable — private browsing, a locked-down
// kiosk profile, or a browser with no IndexedDB quota — and initializeFirestore
// throws in those cases. Falling back to the in-memory client keeps the app
// working online rather than failing to boot at all.
function createDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (err) {
    console.warn('Firestore persistence unavailable, using in-memory cache:', err?.message || err)
    return getFirestore(app)
  }
}

export const db      = createDb()
export const auth    = getAuth(app)
export const storage = getStorage(app)
