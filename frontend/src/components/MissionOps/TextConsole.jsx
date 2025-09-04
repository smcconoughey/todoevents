import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../EventMap/AuthContext';
import { useTheme } from '../ThemeContext';

const TextConsole = () => {
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const baseUrl = useMemo(() => import.meta.env.VITE_API_URL || 'http://localhost:8000', []);
  const [resolvedBase, setResolvedBase] = useState(baseUrl);

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
  const [creating, setCreating] = useState(false);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  }), [token]);

  const fetchSessions = async () => {
    setError('');
    try {
      const res = await fetch(`${resolvedBase}/missionops/text/sessions`, { headers });
      if (!res.ok) throw new Error(`Failed to load sessions (${res.status})`);
      const data = await res.json();
      setSessions(data);
      if (!currentSessionId && data?.length) {
        setCurrentSessionId(data[0].id);
      } else if (!currentSessionId && (!data || data.length === 0)) {
        // Auto-create a session if user has none
        await createSession();
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const fetchSessionDetail = async (id) => {
    setError('');
    try {
      const res = await fetch(`${resolvedBase}/missionops/text/sessions/${id}`, { headers });
      if (res.status === 404) {
        // Session missing or access lost; refresh sessions and try to create a new one
        await fetchSessions();
        if (!sessions.length) {
          await createSession();
        }
        return;
      }
      if (!res.ok) throw new Error('Failed to load session');
      setSessionDetail(await res.json());
    } catch (e) {
      setError(e.message);
    }
  };

  const fetchMessages = async (id) => {
    setError('');
    try {
      const res = await fetch(`${resolvedBase}/missionops/text/sessions/${id}/messages`, { headers });
      if (res.status === 404) {
        await fetchSessions();
        if (!sessions.length) {
          await createSession();
        }
        return;
      }
      if (!res.ok) throw new Error('Failed to load messages');
      setMessages(await res.json());
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchSessions();
      if (!currentSessionId) {
        await createSession();
      }
    };
    if (token) { init(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!currentSessionId) return;
    fetchSessionDetail(currentSessionId);
    fetchMessages(currentSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId]);

  const createSession = async () => {
    if (creating) return;
    setCreating(true); setBusy(true); setError('');
    try {
      const res = await fetch(`${resolvedBase}/missionops/text/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'MissionOps Session' })
      });
      if (!res.ok) throw new Error('Failed to create session');
      const s = await res.json();
      await fetchSessions();
      setCurrentSessionId(s.id);
      await fetchSessionDetail(s.id);
      await fetchMessages(s.id);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); setCreating(false); }
  };

  const resetSession = async (id) => {
    if (!id) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${resolvedBase}/missionops/text/sessions/${id}/reset`, {
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
      const res = await fetch(`${resolvedBase}/missionops/text/sessions/${id}`, {
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
      const res = await fetch(`${resolvedBase}/missionops/text/sessions/reset-all`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed to reset all sessions');
      await fetchSessions();
      if (currentSessionId) { await fetchMessages(currentSessionId); }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const wipeAll = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${resolvedBase}/missionops/text/sessions/wipe-all`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed to wipe sessions');
      await fetchSessions();
      setCurrentSessionId(null);
      setSessionDetail(null);
      setMessages([]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const ensureSession = async () => {
    if (currentSessionId) return currentSessionId;
    await createSession();
    return currentSessionId;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    setBusy(true); setError('');
    try {
      if (!currentSessionId) {
        await ensureSession();
      }
      const res = await fetch(`${resolvedBase}/missionops/text/sessions/${currentSessionId}/messages`, {
        method: 'POST', headers, body: JSON.stringify({ content: input })
      });
      if (res.status === 404) {
        // Session may have been deleted or not exist; create a new one and retry once
        await createSession();
        const sid = currentSessionId;
        if (!sid) throw new Error('No session available');
        const retry = await fetch(`${resolvedBase}/missionops/text/sessions/${sid}/messages`, {
          method: 'POST', headers, body: JSON.stringify({ content: input })
        });
        if (!retry.ok) throw new Error('Failed to send message');
        const msgs = await retry.json();
        setMessages(msgs);
        setInput('');
        return;
      }
      if (!res.ok) throw new Error('Failed to send message');
      const msgs = await res.json();
      setMessages(msgs);
      setInput('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  // Extract simple plan/mindmap from the latest assistant message (best-effort)
  const extractPlan = () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return { schedule: [], map: [] };
    const text = lastAssistant.content || '';
    // Try to parse JSON fenced blocks
    const match = text.match(/```json[\s\S]*?```/i);
    if (match) {
      try {
        const json = JSON.parse(match[0].replace(/```json|```/g, ''));
        return {
          schedule: json.schedule || json.todayFocus || [],
          map: json.mindmap || json.tasks || []
        };
      } catch(_) {}
    }
    // Fallback: split into bullet-like lines
    const lines = text.split(/\n+/).filter(Boolean);
    return { schedule: lines.slice(0, 8), map: lines.slice(8, 24) };
  };
  const plan = extractPlan();

  const uploadContext = async () => {
    if (!currentSessionId || !ctxText.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${resolvedBase}/missionops/text/sessions/${currentSessionId}/context`, {
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
    <div className={`min-h-screen ${bg} ${fg} flex flex-col`}> 
      <div className="max-w-5xl mx-auto w-full flex-1 px-4 pt-4 pb-28 space-y-4">
        {/* Working Plan */}
        <div className={`border ${mono} rounded-lg p-3`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Working Plan</h2>
            <div className="flex gap-2">
              <button disabled={busy} onClick={createSession} className="text-xs px-2 py-1 bg-pin-blue text-white rounded">New Session</button>
              <button disabled={busy || !currentSessionId} onClick={() => resetSession(currentSessionId)} className="text-xs px-2 py-1 border rounded">Reset</button>
              <button disabled={busy || !currentSessionId} onClick={() => deleteSession(currentSessionId)} className="text-xs px-2 py-1 border rounded">Delete</button>
            </div>
          </div>
          {sessionDetail && (
            <div className={`text-xs ${sub} mb-2`}>Session #{sessionDetail.id} · Model: {sessionDetail.model_name || 'default'}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium mb-1">Schedule</div>
              <div className={`border ${mono} rounded p-2 min-h-[120px] text-sm`}>
                {Array.isArray(plan.schedule) && plan.schedule.length > 0 ? (
                  <ul className="list-disc ml-5 space-y-1">
                    {plan.schedule.slice(0, 16).map((it, idx) => (
                      <li key={idx} className="leading-snug">{typeof it === 'string' ? it : JSON.stringify(it)}</li>
                    ))}
                  </ul>
                ) : (
                  <div className={`text-sm ${sub}`}>Send a message to generate a schedule.</div>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Mindmap</div>
              <div className={`border ${mono} rounded p-2 min-h-[120px] text-sm`}>
                {Array.isArray(plan.map) && plan.map.length > 0 ? (
                  <ul className="list-disc ml-5 space-y-1">
                    {plan.map.slice(0, 24).map((it, idx) => (
                      <li key={idx} className="leading-snug">{typeof it === 'string' ? it : JSON.stringify(it)}</li>
                    ))}
                  </ul>
                ) : (
                  <div className={`text-sm ${sub}`}>Assistant responses will be summarized here.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className={`border ${mono} rounded-lg p-3 font-mono text-sm whitespace-pre-wrap max-h-[40vh] overflow-auto`}>
          {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
          {messages.map(m => (
            <div key={m.id} className="mb-2">
              <div className="text-xs opacity-70">[{m.role}]</div>
              <div>{m.content}</div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className={`text-sm ${sub}`}>No messages yet. Ask for a plan below.</div>
          )}
        </div>
      </div>

      {/* Bottom input bar */}
      <div className={`fixed bottom-0 left-0 right-0 ${bg} border-t ${theme==='light'?'border-neutral-200':'border-neutral-800'}`}>
        <div className="max-w-5xl mx-auto w-full px-4 py-3">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask MissionOps..." className={`flex-1 px-3 py-3 border rounded ${theme==='light'?'bg-white':'bg-neutral-900'}`} />
            <button disabled={busy || !input.trim()} onClick={sendMessage} className="px-5 py-3 bg-pin-blue text-white rounded">Send</button>
          </div>
          <div className="flex gap-2 mt-2">
            <input value={ctxTitle} onChange={e => setCtxTitle(e.target.value)} className={`flex-1 md:flex-none md:w-48 px-3 py-2 border rounded ${theme==='light'?'bg-white':'bg-neutral-900'}`} placeholder="Context title" />
            <input type="number" min="1" max="5" value={ctxImportance} onChange={e => setCtxImportance(e.target.value)} className={`w-20 px-3 py-2 border rounded ${theme==='light'?'bg-white':'bg-neutral-900'}`} placeholder="1-5" />
            <input value={ctxText} onChange={e => setCtxText(e.target.value)} className={`flex-1 px-3 py-2 border rounded ${theme==='light'?'bg-white':'bg-neutral-900'}`} placeholder="Paste context (optional)" />
            <button disabled={busy || !ctxText.trim()} onClick={uploadContext} className="px-4 py-2 border rounded">Process</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextConsole;


