import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './hooks/useAuth.jsx'
import { ProgressProvider } from './hooks/useProgress.jsx'
import { ThemeProvider } from './hooks/useTheme.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { api } from './services/api.js'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'

// Ping the backend as soon as the app loads so the Render free-tier container
// is awake before the user submits a form. This is a best-effort fire-and-forget;
// errors are silently ignored because the AuthProvider will surface them when
// the user actually interacts.
api.warmup()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <ProgressProvider>
              <App />
            </ProgressProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
