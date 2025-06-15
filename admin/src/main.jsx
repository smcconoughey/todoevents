import React from 'react'
import ReactDOM from 'react-dom/client'
import AdminDashboard from './AdminDashboard.jsx'
import EnterpriseDashboard from './EnterpriseDashboard.jsx'
import './index.css'

// Determine which dashboard to load based on URL path
const App = () => {
  const path = window.location.pathname;
  
  if (path.includes('/enterprise') || path.includes('/enterprise-dashboard')) {
    return <EnterpriseDashboard />
  } else {
    return <AdminDashboard />
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)