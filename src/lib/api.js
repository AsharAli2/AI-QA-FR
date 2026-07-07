import { supabase } from './supabase';

// Authenticated fetch against the API, attaching the current Supabase JWT.
export async function api(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expired — sign in again.');
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

// Authenticated SSE request. EventSource can't send an Authorization header, so
// we POST with fetch and read the event stream off the response body ourselves.
// Calls onEvent(event, data) per server event; resolves when the stream closes.
export async function apiStream(path, { method = 'POST', body, onEvent } = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expired — sign in again.');
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method,
    body,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!res.ok || !(res.headers.get('content-type') || '').includes('text/event-stream')) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = 'message';
      const dataLines = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue; // keep-alive ping
      try {
        onEvent?.(event, JSON.parse(dataLines.join('\n')));
      } catch {
        // malformed frame — skip it rather than kill the stream
      }
    }
  }
}
