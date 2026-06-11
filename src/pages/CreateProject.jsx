import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const DOC_KINDS = ['flow', 'spec', 'note', 'other'];

const emptyDoc = () => ({ kind: 'flow', title: '', mode: 'text', content: '', file: null });

// Read a File as a base64 string (no data: prefix) for JSON upload.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function CreateProject() {
  const navigate = useNavigate();

  // ----- project fields (projects schema) -----
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [description, setDescription] = useState('');

  // ----- documents (documents schema) — one or more -----
  const [docs, setDocs] = useState([emptyDoc()]);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function updateDoc(i, patch) {
    setDocs((d) => d.map((doc, idx) => (idx === i ? { ...doc, ...patch } : doc)));
  }
  function addDoc() {
    setDocs((d) => [...d, emptyDoc()]);
  }
  function removeDoc(i) {
    setDocs((d) => d.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Build the documents payload. Text mode sends inline content; file mode
      // sends the raw bytes as base64 so the server can extract text (PDFs are
      // parsed server-side, plain text/markdown decoded directly).
      const documents = [];
      for (const doc of docs) {
        if (doc.mode === 'text') {
          if (!doc.content.trim() && !doc.title.trim()) continue; // skip blank rows
          documents.push({ kind: doc.kind, title: doc.title, content: doc.content });
        } else if (doc.file) {
          documents.push({
            kind: doc.kind,
            title: doc.title,
            fileBase64: await fileToBase64(doc.file),
            mimeType: doc.file.type,
            fileName: doc.file.name,
          });
        } else if (doc.title.trim()) {
          documents.push({ kind: doc.kind, title: doc.title });
        }
      }

      // Send to the server, which authorizes the user, creates the project +
      // documents, and chunks + embeds the content (Gemini) into pgvector.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please sign in again.');

      const res = await fetch(`${import.meta.env.VITE_API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          baseUrl,
          allowedDomains: allowedDomains
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          description,
          documents,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create project');

      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>New project</h1>
        <Link className="btn ghost" to="/">
          Cancel
        </Link>
      </header>

      {error && <div className="alert">{error}</div>}

      <form className="card wide" onSubmit={handleSubmit}>
        <h2>Project</h2>
        <label>
          Name *
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Base URL
          <input
            type="url"
            placeholder="https://example.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </label>
        <label>
          Allowed domains (comma-separated)
          <input
            placeholder="example.com, api.example.com"
            value={allowedDomains}
            onChange={(e) => setAllowedDomains(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <h2>Documents</h2>
        <p className="muted">
          Describe the website flows the agent should test. Paste text or upload a file.
        </p>

        {docs.map((doc, i) => (
          <div className="doc-row" key={i}>
            <div className="doc-row-head">
              <select value={doc.kind} onChange={(e) => updateDoc(i, { kind: e.target.value })}>
                {DOC_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input
                placeholder="Title (optional)"
                value={doc.title}
                onChange={(e) => updateDoc(i, { title: e.target.value })}
              />
              <div className="mode-toggle">
                <label className="inline">
                  <input
                    type="radio"
                    name={`mode-${i}`}
                    checked={doc.mode === 'text'}
                    onChange={() => updateDoc(i, { mode: 'text' })}
                  />
                  Text
                </label>
                <label className="inline">
                  <input
                    type="radio"
                    name={`mode-${i}`}
                    checked={doc.mode === 'file'}
                    onChange={() => updateDoc(i, { mode: 'file' })}
                  />
                  File
                </label>
              </div>
              {docs.length > 1 && (
                <button type="button" className="btn ghost small" onClick={() => removeDoc(i)}>
                  Remove
                </button>
              )}
            </div>

            {doc.mode === 'text' ? (
              <textarea
                rows={4}
                placeholder="e.g. User lands on /products, filters by category, adds to cart, checks out…"
                value={doc.content}
                onChange={(e) => updateDoc(i, { content: e.target.value })}
              />
            ) : (
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/plain"
                onChange={(e) => updateDoc(i, { file: e.target.files?.[0] ?? null })}
              />
            )}
          </div>
        ))}

        <button type="button" className="btn ghost" onClick={addDoc}>
          + Add document
        </button>

        <div className="form-actions">
          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  );
}
