import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Import CSS files together for optimal bundling and reduced HTTP requests
import './index.css'
import './styles/variables.css' // Global CSS variables for consistent design system
import './styles/global.css' // Global styles for consistent design system implementation

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)