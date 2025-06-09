// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './components/EventMap/AuthContext'
import { ThemeProvider } from './components/ThemeContext'
import './index.css'

// Debug logging for theme detection
const initialTheme = localStorage.getItem('theme') || 
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
console.log('Initial detected theme:', initialTheme);
console.log('System dark mode preference:', window.matchMedia('(prefers-color-scheme: dark)').matches);

// Apply the initial theme before React renders
document.documentElement.setAttribute('data-theme', initialTheme);
document.documentElement.classList.add(initialTheme === 'dark' ? 'dark-mode' : 'light-mode');
document.documentElement.classList.remove(initialTheme === 'dark' ? 'light-mode' : 'dark-mode');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/*" element={<App />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)