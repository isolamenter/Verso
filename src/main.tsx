import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initLogger } from './utils/logger'
import './index.css'
import App from './App.tsx'

initLogger()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

