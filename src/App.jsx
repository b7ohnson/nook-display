import { useState, useEffect, useRef, useMemo } from 'react'
import Clock from './components/Clock'
import WeatherWidget from './components/WeatherWidget'
import MiniCalendar from './components/MiniCalendar'
import WeekView from './components/WeekView'
import ChoreList from './components/ChoreList'
import GroceryList from './components/GroceryList'
import MediaPage from './components/MediaPage'
import MealPlanner from './components/MealPlanner'
import EventModal from './components/EventModal'
import { IconHome, IconTv, IconUtensils, IconSun, IconMoon, IconGamepad } from './components/Icons'
import GamesPage from './components/games/GamesPage'
import PhotoSlideshow from './components/PhotoSlideshow'
import LoginPage from './components/LoginPage'
import RemindersPanel from './components/RemindersPanel'
import ToastNotifications from './components/ToastNotifications'
import { useGoogleCalendar, parseEventId } from './hooks/useGoogleCalendar'
import { useAuth } from './hooks/useAuth'
import { useDarkMode } from './hooks/useDarkMode'
import { useNotifications } from './hooks/useNotifications'
import { events as mockEvents, familyMembers } from './data/mockData'
import './App.css'

const IDLE_MS  = 10 * 60 * 1000
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function normalizeMock(raw) {
  const memberMap = Object.fromEntries(familyMembers.map(m => [m.id, m]))
  return raw.map(e => {
    const m = e.memberId ? memberMap[e.memberId] : null
    return { id: e.id, title: e.title, date: e.date, time: e.time || null, endTime: e.endTime || null, allDay: !!e.allDay, label: m?.name || null, color: m?.color || '#94a3b8' }
  })
}

function AccountBadge({ label, account }) {
  const { isSignedIn, signIn, signOut, user, loading, error } = account
  if (loading) return <span className="gcal-hint">Syncing {label}…</span>
  if (isSignedIn) return (
    <div className="gcal-user">
      {user?.picture
        ? <img src={user.picture} alt="" className="gcal-avatar" />
        : <div className="gcal-avatar gcal-avatar--initial">{label[0]}</div>}
      <span className="gcal-name">{user?.name || label}</span>
      {error && <button className="gcal-btn gcal-btn--error" onClick={account.refetch} title={error}>↻</button>}
      <button className="gcal-btn gcal-btn--subtle" onClick={signOut}>✕</button>
    </div>
  )
  return (
    <button className="gcal-btn" onClick={signIn}>
      Connect {label}
    </button>
  )
}

const TABS = [
  { id: 'home',  label: 'Home',         Icon: IconHome     },
  { id: 'media', label: 'Media',        Icon: IconTv       },
  { id: 'meals', label: 'Meal Planner', Icon: IconUtensils },
  { id: 'games', label: 'Games',        Icon: IconGamepad  },
]

export default function App() {
  const { user, loading: authLoading, signIn, logOut } = useAuth()
  const { dark, toggle: toggleDark } = useDarkMode()
  const { toasts, dismiss } = useNotifications()
  const [isIdle, setIsIdle]             = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [page, setPage]                 = useState('home')
  const [modal, setModal]               = useState(null) // { event?, date?, time?, allDay? }
  const timerRef = useRef(null)

  const blessing = useGoogleCalendar(CLIENT_ID, 'blessing')
  const pearl    = useGoogleCalendar(CLIENT_ID, 'pearl')

  const anyConnected = blessing.isSignedIn || pearl.isSignedIn

  const handleEventDrop = async (event, newDate, newTime) => {
    if (!anyConnected || event.allDay) return
    const { storageKey, calendarId, eventId } = parseEventId(event.id)
    const account = storageKey === 'blessing' ? blessing : pearl
    if (!account.isSignedIn) return
    const origDuration = (
      event.endTime
        ? (parseInt(event.endTime) * 60 + parseInt(event.endTime.split(':')[1])) -
          (parseInt(event.time) * 60 + parseInt(event.time?.split(':')[1] || 0))
        : 60
    )
    const [nh, nm] = newTime.split(':').map(Number)
    const newEndMins = nh * 60 + nm + (origDuration > 0 ? origDuration : 60)
    const endTime = `${String(Math.floor(newEndMins / 60) % 24).padStart(2,'0')}:${String(newEndMins % 60).padStart(2,'0')}`
    await account.updateEvent(calendarId, eventId, {
      title: event.title, date: newDate, startTime: newTime, endTime, allDay: false,
    })
  }

  const events = useMemo(() => {
    if (!anyConnected) return normalizeMock(mockEvents)
    return [...(blessing.events || []), ...(pearl.events || [])]
  }, [anyConnected, blessing.events, pearl.events])

  const legend = useMemo(() => {
    if (!anyConnected) return familyMembers.map(m => ({ name: m.name, color: m.color }))
    const seen = new Set()
    return events
      .filter(e => e.label && !seen.has(e.label) && seen.add(e.label))
      .map(e => ({ name: e.label, color: e.color }))
      .slice(0, 10)
  }, [anyConnected, events])

  useEffect(() => {
    const wake = () => {
      setIsIdle(false)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setIsIdle(true), IDLE_MS)
    }
    window.addEventListener('mousemove', wake)
    window.addEventListener('mousedown', wake)
    window.addEventListener('keydown', wake)
    window.addEventListener('touchstart', wake)
    timerRef.current = setTimeout(() => setIsIdle(true), IDLE_MS)
    return () => {
      clearTimeout(timerRef.current)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('mousedown', wake)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('touchstart', wake)
    }
  }, [])

  if (authLoading) return (
    <div className="auth-loading">
      <div className="auth-loading-spinner" />
    </div>
  )

  if (!user) return <LoginPage onSignIn={signIn} />

  return (
    <div className="app">
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
          <button className="dark-toggle" onClick={toggleDark} title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
          <div className="auth-user">
            {user.photoURL
              ? <button className="auth-avatar-btn" onClick={logOut} aria-label="Sign out" title="Sign out">
                  <img src={user.photoURL} alt="" className="auth-avatar" />
                </button>
              : <button className="auth-avatar-btn auth-avatar auth-avatar--initial" onClick={logOut} aria-label="Sign out" title="Sign out">
                  {user.displayName?.[0] || '?'}
                </button>}
            <button className="auth-signout" onClick={logOut} title="Sign out">Sign out</button>
          </div>
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
              <WeekView
                events={events}
                focusDate={selectedDate}
                onSlotClick={(date, time, allDay) => anyConnected && setModal({ date, time, allDay })}
                onEventClick={(event) => anyConnected && setModal({ event })}
                onEventDrop={anyConnected ? handleEventDrop : undefined}
              />
            </section>
          </main>
          <footer className="app-footer">
            <ChoreList />
          </footer>
        </>
      )}

      {page === 'media' && <MediaPage />}
      {page === 'meals' && <MealPlanner />}
      {page === 'games' && <div className="games-page"><GamesPage /></div>}

      {modal && (
        <EventModal
          event={modal.event}
          defaultDate={modal.date}
          defaultTime={modal.time}
          accounts={[
            { key: 'blessing', label: 'Blessing', ...blessing },
            { key: 'pearl',    label: 'Pearl',    ...pearl    },
          ]}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
    </div>
  )
}
