import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(err) {
    return { error: err }
  }

  componentDidCatch(err, info) {
    console.error('[NooK ErrorBoundary]', err, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <p className="error-boundary__msg">Something went wrong</p>
          <button
            className="error-boundary__btn"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
