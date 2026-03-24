import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import App from './App.tsx'
import { createLogger, initializeLogger } from './utils/logger'

initializeLogger()

const bootLogger = createLogger('main')
const rootElement = document.getElementById('root')

if (!rootElement) {
  bootLogger.error('Root DOM node was not found during startup')
  throw new Error('Root DOM node not found')
}

bootLogger.info('Bootstrapping React application')

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)