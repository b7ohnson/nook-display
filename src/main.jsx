import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'

// Nobody reloads a wall-mounted display, so a deploy has to land on its own.
// registerSW(true) tells the waiting worker to activate and reloads once it
// takes control; without this the new worker stays in `waiting` indefinitely
// and the screen keeps serving the previous build out of the precache.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true) },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary root>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
