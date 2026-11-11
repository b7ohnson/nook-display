import { Component } from 'react'

const RELOAD_KEY     = 'nook-root-reloads'
const RELOAD_SECS    = 30
const BACKOFF_SECS   = 5 * 60

function readReloads() {
  try { return Number(sessionStorage.getItem(RELOAD_KEY) || 0) } catch { return 0 }
}

/**
 * `root` wraps the whole app: nobody is standing by to tap a button on a wall
 * display, so it reloads on its own. Without `root` it wraps a single tab and
 * leaves the rest of the display running.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, secondsLeft: null }
    this.timer = null
    this.healthyTimer = null
  }

  static getDerivedStateFromError(err) {
    return { error: err }
  }

  componentDidMount() {
    if (!this.props.root) return
    // A page that stays up for a few minutes counts as recovered.
    this.healthyTimer = setTimeout(() => {
      if (!this.state.error) { try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* storage unavailable */ } }
    }, 3 * 60 * 1000)
  }

  componentDidCatch(err, info) {
    console.error('[NooK ErrorBoundary]', err, info.componentStack)
    if (!this.props.root) return
    // Back off if reloading is not fixing it, so a persistent fault does not
    // hammer the network every 30 seconds for days.
    const reloads = readReloads()
    this.setState({ secondsLeft: reloads >= 3 ? BACKOFF_SECS : RELOAD_SECS })
    this.timer = setInterval(() => {
      this.setState(s => {
        if (s.secondsLeft <= 1) { this.reload(); return { secondsLeft: 0 } }
        return { secondsLeft: s.secondsLeft - 1 }
      })
    }, 1000)
  }

  componentWillUnmount() {
    clearInterval(this.timer)
    clearTimeout(this.healthyTimer)
  }

  // A reload, not a re-render: a rejected React.lazy import stays rejected for
  // the life of the page, so re-rendering the same tree can never recover.
  reload = () => {
    clearInterval(this.timer)
    if (this.props.root) {
      try { sessionStorage.setItem(RELOAD_KEY, String(readReloads() + 1)) } catch { /* storage unavailable */ }
    }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    const { root } = this.props
    const { secondsLeft } = this.state
    return (
      <div className={`error-boundary ${root ? 'error-boundary--root' : ''}`} role="alert">
        <p className="error-boundary__msg">
          {root ? 'NooK hit a snag and will restart itself shortly.' : 'Something went wrong'}
        </p>
        {root && secondsLeft > 0 && (
          <p className="error-boundary__hint">
            Restarting in {secondsLeft >= 120 ? `${Math.ceil(secondsLeft / 60)} minutes` : `${secondsLeft} seconds`}
          </p>
        )}
        <button className="error-boundary__btn" onClick={this.reload}>
          {root ? 'Restart now' : 'Reload'}
        </button>
      </div>
    )
  }
}
