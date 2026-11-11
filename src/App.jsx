import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react'
import { lazyWithReload } from './utils/lazyWithReload'
import Clock from './components/Clock'
import WeatherWidget from './components/WeatherWidget'
import MiniCalendar from './components/MiniCalendar'
import WeekView from './components/WeekView'
import ChoreList from './components/ChoreList'
import GroceryList from './components/GroceryList'
import EventModal from './components/EventModal'
import { IconHome, IconTv, IconUtensils, IconSun, IconMoon, IconGamepad, IconSettings, IconMusic } from './components/Icons'
import PhotoSlideshow from './components/PhotoSlideshow'
import LoginPage from './components/LoginPage'
import RemindersPanel from './components/RemindersPanel'
import ToastNotifications from './components/ToastNotifications'
import { useGoogleCalendar, parseEventId, fmtLocalDate, fmtLocalTime } from './hooks/useGoogleCalendar'
import { useAuth } from './hooks/useAuth'
import { useDarkMode } from './hooks/useDarkMode'
import { useNotifications, notify } from './hooks/useNotifications'
import { useConfirmTap } from './hooks/useConfirmTap'
import { useToday } from './hooks/useToday'
import { useSettings } from './hooks/useSettings'
import SettingsPanel from './components/SettingsPanel'
import SpotifyBar from './components/SpotifyBar'
import { SpotifyProvider } from './hooks/SpotifyContext'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

// The four tab bodies are the bulk of the bundle and only one is ever on
// screen. Loaded on demand so the Pi boots the home tab without parsing the
// games engine, the Spotify browser and the meal planner first.
const MediaPage   = lazyWithReload(() => import('./components/MediaPage'))
const SpotifyPage = lazyWithReload(() => import('./components/SpotifyPage'))
const MealPlanner = lazyWithReload(() => import('./components/MealPlanner'))
const GamesPage   = lazyWithReload(() => import('./components/games/GamesPage'))

const IDLE_MS  = 2 * 60 * 1000
// During a game the players are on their phones and nobody touches the TV, and
// an open dialog means someone is mid-task. The slideshow is held off for a
// long while rather than forever so an abandoned screen still gets covered.
const IDLE_BUSY_MS = 2 * 60 * 60 * 1000
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Shown while a tab's chunk loads. Reuses the existing auth spinner so a tab
// switch looks the same as the rest of the app rather than flashing bare text.
function TabLoading() {
  return (
    <div className="auth-loading">
      <div className="auth-loading-spinner" />
    </div>
  )
}

function AccountBadge({ label, account }) {
  const { isSignedIn, needsReconnect, signIn, signOut, user, loading, error } = account
  const [confirming, tapDisconnect] = useConfirmTap(signOut)
  const disconnect = (
    <button
      className={`gcal-btn gcal-btn--subtle ${confirming ? 'gcal-btn--confirm' : ''}`}
      onClick={tapDisconnect}
      aria-label={confirming ? `Tap again to disconnect ${label}'s calendar` : `Disconnect ${label}'s calendar`}
    >
      {confirming ? 'Disconnect?' : '✕'}
    </button>
  )
  if (loading && !isSignedIn) return <span className="gcal-hint">Syncing {label}…</span>
  if (needsReconnect) return (
    <div className="gcal-user">
      <button className="gcal-btn gcal-btn--reconnect" onClick={signIn} title={error || undefined}>
        Reconnect {label}
      </button>
      {disconnect}
    </div>
  )
  if (isSignedIn) return (
    <div className="gcal-user">
      {user?.picture
        ? <img src={user.picture} alt="" className="gcal-avatar" />
        : <div className="gcal-avatar gcal-avatar--initial">{label[0]}</div>}
      <span className="gcal-name">{user?.name || label}</span>
      {error && (
        <button className="gcal-btn gcal-btn--error" onClick={account.refetch} title={error} aria-label={`${error}. Retry`}>↻</button>
      )}
      {disconnect}
    </div>
  )
  return (
    <button className="gcal-btn" onClick={signIn} title={error || undefined}>
      Connect {label}
    </button>
  )
}

function SignOutControls({ user, logOut }) {
  const [confirming, tap] = useConfirmTap(logOut)
  const label = confirming ? 'Tap again to sign out' : 'Sign out'
  return (
    <div className="auth-user">
      {user.photoURL
        ? <button className="auth-avatar-btn" onClick={tap} aria-label={label} title={label}>
            <img src={user.photoURL} alt="" className="auth-avatar" />
          </button>
        : <button className="auth-avatar-btn auth-avatar auth-avatar--initial" onClick={tap} aria-label={label} title={label}>
            {user.displayName?.[0] || '?'}
          </button>}
      <button className={`auth-signout ${confirming ? 'auth-signout--confirm' : ''}`} onClick={tap} title={label}>
        {confirming ? 'Tap again to sign out' : 'Sign out'}
      </button>
    </div>
  )
}

function CalendarNotConnected({ accounts }) {
  return (
    <div className="cal-disconnected">
      <h2 className="cal-disconnected__title">Calendar not connected</h2>
      {CLIENT_ID ? (
        <>
          <p className="cal-disconnected__text">Connect a Google account to show the family calendar here.</p>
          <div className="cal-disconnected__actions">
            {accounts.map(a => (
              <button key={a.key} className="gcal-btn" onClick={a.signIn}>Connect {a.label}</button>
            ))}
          </div>
          {accounts.map(a => a.error && <p key={a.key} className="cal-disconnected__error">{a.label}: {a.error}</p>)}
        </>
      ) : (
        <p className="cal-disconnected__text">Google Calendar is not set up on this display.</p>
      )}
    </div>
  )
}

const TABS = [
  { id: 'home',  label: 'Home',         Icon: IconHome     },
  { id: 'media', label: 'Media',        Icon: IconTv       },
  { id: 'music', label: 'Music',        Icon: IconMusic    },
  { id: 'meals', label: 'Meal Planner', Icon: IconUtensils },
  { id: 'games', label: 'Games',        Icon: IconGamepad  },
]

export default function App() {
  const { user, loading: authLoading, signIn, logOut } = useAuth()
  // Theme is applied to <html>, so it has to cover the login screen too.
  const { dark, toggle: toggleDark } = useDarkMode()

  if (authLoading) return (
    <div className="auth-loading">
      <div className="auth-loading-spinner" />
    </div>
  )

  if (!user) return <LoginPage onSignIn={signIn} />

  return <SignedInApp user={user} logOut={logOut} dark={dark} toggleDark={toggleDark} />
}

// Everything that reads Firestore or Google Calendar lives below the auth gate.
// React runs hooks unconditionally, so while these sat in App() they subscribed
// before sign-in and every cold load logged permission-denied against rules that
// correctly require auth.
function SignedInApp({ user, logOut, dark, toggleDark }) {
  const { toasts, dismiss } = useNotifications()
  const { settings, update: updateSetting } = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const closeSettings = useCallback(() => setShowSettings(false), [])
  const [isIdle, setIsIdle]             = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [page, setPage]                 = useState('home')
  const [modal, setModal]               = useState(null) // { event?, date?, time?, allDay? }
  const timerRef = useRef(null)

  // At midnight the highlighted day follows the calendar to the new today.
  const today = useToday()
  useEffect(() => { setSelectedDate(new Date()) }, [today])

  const blessing = useGoogleCalendar(CLIENT_ID, 'blessing')
  const pearl    = useGoogleCalendar(CLIENT_ID, 'pearl')

  const accounts = useMemo(() => [
    { key: 'blessing', label: 'Blessing', ...blessing },
    { key: 'pearl',    label: 'Pearl',    ...pearl    },
  ], [blessing, pearl])

  const anyConnected = blessing.isSignedIn || pearl.isSignedIn
  // Includes connections that are waiting for a Reconnect tap: their last
  // loaded events stay on screen, flagged as possibly out of date.
  const anyKnown = anyConnected || blessing.needsReconnect || pearl.needsReconnect
  const stale    = accounts.filter(a => a.needsReconnect)

  const accountFor = (event) => accounts.find(a => a.key === parseEventId(event.id).storageKey)

  const handleEventDrop = async (event, newDate, newTime) => {
    if (event.allDay || !event.writable || event.startMs == null) return
    const account = accountFor(event)
    if (!account?.isSignedIn) {
      notify('Reconnect the calendar before moving events')
      return
    }
    const { calendarId, eventId } = parseEventId(event.id)
    // Shift start and end together so the duration survives, including events
    // that run past midnight.
    const start = new Date(`${newDate}T${newTime}:00`)
    const end   = new Date(start.getTime() + Math.max(event.endMs - event.startMs, 0))
    if (start.getTime() === event.startMs) return
    try {
      await account.updateEvent(calendarId, eventId, {
        date: fmtLocalDate(start), startTime: fmtLocalTime(start),
        endDate: fmtLocalDate(end), endTime: fmtLocalTime(end),
        allDay: false,
      })
    } catch (err) {
      notify(`Could not move "${event.title}": ${err.message || 'calendar error'}`)
    }
  }

  const events = useMemo(
    () => [...(blessing.events || []), ...(pearl.events || [])],
    [blessing.events, pearl.events]
  )

  const legend = useMemo(() => {
    const seen = new Set()
    return events
      .filter(e => e.label && !seen.has(e.label) && seen.add(e.label))
      .map(e => ({ name: e.label, color: e.color }))
      .slice(0, 10)
  }, [events])

  const busy = page === 'games' || !!modal || showSettings
  const idleMs = busy ? IDLE_BUSY_MS : IDLE_MS

  useEffect(() => {
    const wake = () => {
      setIsIdle(false)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setIsIdle(true), idleMs)
    }
    window.addEventListener('mousemove', wake)
    window.addEventListener('mousedown', wake)
    window.addEventListener('keydown', wake)
    window.addEventListener('touchstart', wake)
    wake()
    return () => {
      clearTimeout(timerRef.current)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('mousedown', wake)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('touchstart', wake)
    }
  }, [idleMs])

  return (
    <SpotifyProvider>
    <div className="app">
      <h1 className="sr-only">NooK Family Display</h1>
      {isIdle && <PhotoSlideshow />}
      <ToastNotifications toasts={toasts} dismiss={dismiss} />

      <header className="app-header">
        <div className="app-header-brand">
          <svg className="app-header-mark" width="28" height="32" viewBox="0 0 64 74" aria-label="NooK">
            <path d="M7,70 L7,31 C7,14 19,5 32,5 C45,5 57,14 57,31 L57,70"
                  stroke="#F0A500" strokeWidth="3" fill="none"
                  strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3" y1="70" x2="61" y2="70"
                  stroke="#F0A500" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="21" cy="40" r="10" fill="#4A7FA5"/>
            <circle cx="43" cy="40" r="10" fill="#F0A500"/>
          </svg>
          <Clock />
        </div>
        <div className="header-right">
          <WeatherWidget />
          {CLIENT_ID && (
            <div className="gcal-accounts">
              <AccountBadge label="Blessing" account={blessing} />
              <div className="gcal-divider" />
              <AccountBadge label="Pearl" account={pearl} />
            </div>
          )}
          <button className="dark-toggle" onClick={toggleDark} aria-label={dark ? 'Light mode' : 'Dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
          <button className="dark-toggle" onClick={() => setShowSettings(true)} aria-label="Display settings" title="Settings">
            <IconSettings size={16} />
          </button>
          <SignOutControls user={user} logOut={logOut} />
        </div>
      </header>

      <nav className="page-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`page-tab ${page === id ? 'page-tab--active' : ''}`}
            onClick={() => setPage(id)}
            aria-current={page === id ? 'page' : undefined}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      {page === 'home' && (
        <>
          <main className="app-main">
            <aside className="left-panel">
              <MiniCalendar events={events} legend={legend} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              <RemindersPanel events={events} />
              <GroceryList />
            </aside>
            <section className="right-panel">
              {!anyKnown ? (
                <CalendarNotConnected accounts={accounts} />
              ) : (
                <>
                  {stale.length > 0 && (
                    <div className="cal-stale" role="status">
                      <span>
                        {stale.map(a => a.label).join(' and ')}: calendar needs reconnecting — events may be out of date.
                      </span>
                      {stale.map(a => (
                        <button key={a.key} className="gcal-btn gcal-btn--reconnect" onClick={a.signIn}>
                          Reconnect {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <WeekView
                    events={events}
                    focusDate={selectedDate}
                    onSlotClick={(date, time, allDay) => anyConnected && setModal({ date, time, allDay })}
                    onEventClick={(event) => accountFor(event)?.isSignedIn && setModal({ event })}
                    onEventDrop={anyConnected ? handleEventDrop : undefined}
                  />
                </>
              )}
            </section>
          </main>
          <footer className="app-footer">
            <ChoreList />
          </footer>
        </>
      )}

      {/* ErrorBoundary outside Suspense so a chunk that fails even after the
          reload in lazyWithReload surfaces as the tab's error state rather
          than taking the whole display down. */}
      {page === 'media' && <ErrorBoundary><Suspense fallback={<TabLoading />}><MediaPage /></Suspense></ErrorBoundary>}
      {page === 'music' && <ErrorBoundary><Suspense fallback={<TabLoading />}><SpotifyPage /></Suspense></ErrorBoundary>}
      {page === 'meals' && <ErrorBoundary><Suspense fallback={<TabLoading />}><MealPlanner /></Suspense></ErrorBoundary>}
      {page === 'games' && <ErrorBoundary><Suspense fallback={<TabLoading />}><div className="games-page"><GamesPage /></div></Suspense></ErrorBoundary>}

      <SettingsPanel
        open={showSettings}
        onClose={closeSettings}
        settings={settings}
        onUpdate={updateSetting}
      />

      {modal && (
        <EventModal
          event={modal.event}
          defaultDate={modal.date}
          defaultTime={modal.time}
          defaultAllDay={modal.allDay}
          accounts={accounts}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
      <SpotifyBar />
    </div>
    </SpotifyProvider>
  )
}
