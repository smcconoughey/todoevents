import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../EventMap/AuthContext';
import { useTheme } from '../ThemeContext';

const TextConsole = () => {
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const baseUrl = useMemo(() => import.meta.env.VITE_API_URL || 'http://localhost:8000', []);

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [ctxTitle, setCtxTitle] = useState('Context Upload');
  const [ctxImportance, setCtxImportance] = useState(3);
  const [ctxText, setCtxText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  }), [token]);

  const fetchSessions = async () => {
    setError('');
    try {
      const res = await fetch(`${baseUrl}/missionops/text/sessions`, { headers });
      if (!res.ok) throw new Error(`Failed to load sessions (${res.status})`);
      const data = await res.json();
      setSessions(data);
      if (!currentSessionId && data?.length) setCurrentSessionId(data[0].id);
    } catch (e) {
      setError(e.message);
    }
  };

  const fetchSessionDetail = async (id) => {
    setError('');
    try {
      const res = await fetch(`${baseUrl}/missionops/text/sessions/${id}`, { headers });
      if (!res.ok) throw new Error('Failed to load session');
      setSessionDetail(await res.json());
    } catch (e) {
      setError(e.message);
    }
  };

  const fetchMessages = async (id) => {
    setError('');
    try {
      const res = await fetch(`${baseUrl}/missionops/text/sessions/${id}/messages`, { headers });
      if (!res.ok) throw new Error('Failed to load messages');
      setMessages(await res.json());
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!currentSessionId) return;
    fetchSessionDetail(currentSessionId);
    fetchMessages(currentSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId]);

  const createSession = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${baseUrl}/missionops/text/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'MissionOps Session' })
      });
      if (!res.ok) throw new Error('Failed to create session');
      const s = await res.json();
      await fetchSessions();
      setCurrentSessionId(s.id);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const resetSession = async (id) => {
    if (!id) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${baseUrl}/missionops/text/sessions/${id}/reset`, {
        method: 'POST', headers
      });
      if (!res.ok) throw new Error('Failed to reset session');
      await fetchSessionDetail(id);
      await fetchMessages(id);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const deleteSession = async (id) => {
    if (!id) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${baseUrl}/missionops/text/sessions/${id}`, {
        method: 'DELETE', headers
      });
      if (!res.ok) throw new Error('Failed to delete session');
      await fetchSessions();
      setCurrentSessionId(null);
      setSessionDetail(null);
      setMessages([]);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const resetAll = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${baseUrl}/missionops/text/sessions/reset-all`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed to reset all sessions');
      await fetchSessions();
      if (currentSessionId) { await fetchMessages(currentSessionId); }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const wipeAll = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${baseUrl}/missionops/text/sessions/wipe-all`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed to wipe sessions');
      await fetchSessions();
      setCurrentSessionId(null);
      setSessionDetail(null);
      setMessages([]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const sendMessage = async () => {
    if (!currentSessionId || !input.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${baseUrl}/missionops/text/sessions/${currentSessionId}/messages`, {
        method: 'POST', headers, body: JSON.stringify({ content: input })
      });
      if (!res.ok) throw new Error('Failed to send message');
      const msgs = await res.json();
      setMessages(msgs);
      setInput('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const uploadContext = async () => {
    if (!currentSessionId || !ctxText.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${baseUrl}/missionops/text/sessions/${currentSessionId}/context`, {
        method: 'POST', headers,
        body: JSON.stringify({ title: ctxTitle, importance: Number(ctxImportance) || 3, text: ctxText, source_type: 'upload' })
      });
      if (!res.ok) throw new Error('Failed to upload context');
      await fetchSessionDetail(currentSessionId);
      setCtxText('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const bg = theme === 'light' ? 'bg-white' : 'bg-neutral-950';
  const fg = theme === 'light' ? 'text-neutral-900' : 'text-white';
  const sub = theme === 'light' ? 'text-neutral-600' : 'text-neutral-300';
  const mono = theme === 'light' ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900/50 border-neutral-700';

  return (
    <div className={`min-h-screen ${bg} ${fg} p-4`}> 
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`md:col-span-1 border ${mono} rounded-lg p-3`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Sessions</h2>
            <button disabled={busy} onClick={createSession} className="text-sm px-2 py-1 bg-pin-blue text-white rounded">New</button>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {sessions.map(s => (
              <div key={s.id} className={`p-2 rounded border cursor-pointer ${currentSessionId===s.id ? 'border-pin-blue' : 'border-transparent'}`} onClick={() => setCurrentSessionId(s.id)}>
                <div className="text-sm font-medium">{s.title || `Session ${s.id}`}</div>
                <div className={`text-xs ${sub}`}>id: {s.id}</div>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className={`text-sm ${sub}`}>No sessions. Create one to begin.</div>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <button disabled={busy} onClick={resetAll} className="flex-1 text-xs px-2 py-1 border rounded">Reset All</button>
            <button disabled={busy} onClick={wipeAll} className="flex-1 text-xs px-2 py-1 border rounded">Wipe All</button>
          </div>
        </div>

        <div className={`md:col-span-2 border ${mono} rounded-lg p-3 space-y-3`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Text Console</h2>
            <div className="flex gap-2">
              <button disabled={busy || !currentSessionId} onClick={() => resetSession(currentSessionId)} className="text-xs px-2 py-1 border rounded">Reset</button>
              <button disabled={busy || !currentSessionId} onClick={() => deleteSession(currentSessionId)} className="text-xs px-2 py-1 border rounded">Delete</button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-500">{error}</div>
          )}

          {sessionDetail && (
            <div className={`text-xs ${sub}`}>
              Model: {sessionDetail.model_name || 'default'} · Max Chars: {sessionDetail.max_context_chars} · Updated: {sessionDetail.updated_at}
            </div>
          )}

          <div className={`border ${mono} rounded p-2 max-h-[45vh] overflow-auto font-mono text-sm whitespace-pre-wrap`}> 
            {messages.map(m => (
              <div key={m.id} className="mb-2">
                <div className="text-xs opacity-70">[{m.role}]</div>
                <div>{m.content}</div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className={`text-sm ${sub}`}>No messages yet. Send a message below.</div>
            )}
          </div>

          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type your message..." className={`flex-1 px-3 py-2 border rounded ${theme==='light'?'bg-white':'bg-neutral-900'}`} />
            <button disabled={busy || !currentSessionId || !input.trim()} onClick={sendMessage} className="px-4 py-2 bg-pin-blue text-white rounded">Send</button>
          </div>

          <div className="border-t pt-3">
            <div className="text-sm font-medium mb-1">Upload Context</div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
              <input value={ctxTitle} onChange={e => setCtxTitle(e.target.value)} className={`md:col-span-2 px-3 py-2 border rounded ${theme==='light'?'bg-white':'bg-neutral-900'}`} placeholder="Title" />
              <input type="number" min="1" max="5" value={ctxImportance} onChange={e => setCtxImportance(e.target.value)} className={`md:col-span-1 px-3 py-2 border rounded ${theme==='light'?'bg-white':'bg-neutral-900'}`} placeholder="Importance (1-5)" />
              <textarea value={ctxText} onChange={e => setCtxText(e.target.value)} className={`md:col-span-3 px-3 py-2 border rounded h-20 ${theme==='light'?'bg-white':'bg-neutral-900'}`} placeholder="Paste context text here..." />
            </div>
            <div className="flex justify-end mt-2">
              <button disabled={busy || !currentSessionId || !ctxText.trim()} onClick={uploadContext} className="px-3 py-2 border rounded">Process Context</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextConsole;


