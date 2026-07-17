import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LoggerProvider } from './utils/logger/LoggerContext'
import { ErrorBoundary } from './utils/errorBoundary'
import { db } from './firebase'
import { getLogger, initLogger } from './utils/logger'
import { detectLongTasks, monitorWebVitals } from './utils/performance'

// Initialize logger
const logger = initLogger(db);

// Set up performance monitoring
if (import.meta.env.PROD) {
  detectLongTasks(logger);
  monitorWebVitals(logger);
}

// Global error handlers
window.addEventListener('error', (event) => {
  logger.error('Uncaught error', {
    error: {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    },
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', {
    error: {
      reason: event.reason?.message || event.reason,
      stack: event.reason?.stack,
    },
  });
});

logger.info('Application starting', {
  environment: import.meta.env.MODE,
  timestamp: new Date().toISOString(),
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary componentName="App">
      <LoggerProvider db={db}>
        <App />
      </LoggerProvider>
    </ErrorBoundary>
  </StrictMode>,
)
