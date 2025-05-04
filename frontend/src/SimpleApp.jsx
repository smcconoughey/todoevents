// src/SimpleApp.jsx
import { useState, useEffect } from 'react';
import { API_URL } from './config';

function SimpleApp() {
  const [status, setStatus] = useState('Loading...');
  
  useEffect(() => {
    // Test the health endpoint
    fetch(`${API_URL}/health`)
      .then(res => res.json())
      .then(data => setStatus(`Backend is working! Status: ${data.status}`))
      .catch(err => setStatus(`Error connecting to backend: ${err.message}`));
  }, []);
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>EventFinder Status</h1>
      <p>{status}</p>
    </div>
  );
}

export default SimpleApp;