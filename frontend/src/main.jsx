// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import SimpleApp from './SimpleApp.jsx'
// import App from './App.jsx' // Comment this out temporarily

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SimpleApp />
  </React.StrictMode>,
)