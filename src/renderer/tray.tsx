import React from 'react'
import ReactDOM from 'react-dom/client'
import TrayPopup from './tray/TrayPopup'
import './styles/globals.css'
import './tray/tray.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrayPopup />
  </React.StrictMode>
)
