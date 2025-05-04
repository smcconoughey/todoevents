import React from 'react';
import { AuthProvider } from './components/EventMap/AuthContext';
import EventMap from './components/EventMap';

function App() {
  return (
    <AuthProvider>
      <div className="h-screen w-screen">
        <EventMap />
      </div>
    </AuthProvider>
  );
}

export default App;