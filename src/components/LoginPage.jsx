import { useState, useEffect } from 'react'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

// Same mark as the header in App.jsx (arch, two figures, ground line).
function NookMark() {
  return (
    <svg className="login-mark" width="64" height="74" viewBox="0 0 64 74" aria-hidden="true" focusable="false">
      <path d="M7,70 L7,31 C7,14 19,5 32,5 C45,5 57,14 57,31 L57,70"
            stroke="#F0A500" strokeWidth="3" fill="none"
            strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="3" y1="70" x2="61" y2="70"
            stroke="#F0A500" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="21" cy="40" r="10" fill="#4A7FA5"/>
      <circle cx="43" cy="40" r="10" fill="#F0A500"/>
    </svg>
  )
}

function errorText(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  return error.message || 'Sign-in did not finish. Try again.'
}

export default function LoginPage({ onSignIn, error }) {
  const now = useClock()
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const handleSignIn = async () => {
    setLoading(true)
    setLocalError('')
    try {
      await onSignIn()
    } catch (err) {
      setLocalError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  const message = errorText(error) || localError

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <NookMark />
          <span className="login-logo-name">NooK</span>
        </div>

        <div className="login-clock" aria-hidden="true">
          <div className="login-time">{time}</div>
          <div className="login-date">{date}</div>
        </div>

        <button className="login-google-btn" onClick={handleSignIn} disabled={loading}>
          {loading ? (
            <span className="login-spinner" aria-hidden="true" />
          ) : (
            <svg className="login-google-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? 'Signing in' : 'Sign in with Google'}
        </button>

        {message && <p className="login-error" role="alert">{message}</p>}

        <p className="login-hint">Use one of the family's Google accounts.</p>
      </div>
    </main>
  )
}
