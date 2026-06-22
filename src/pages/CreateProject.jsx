import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function CreateProject() {
  const navigate = useNavigate();

  // ----- project fields (projects schema) -----
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [description, setDescription] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please sign in again.');

      // Simple create: just the project. Flows and docs are added afterwards on
      // the project page, so this is a plain JSON request (no file upload here).
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
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create project');

      // Drop the user straight into the new project so they can pick how to test.
      navigate(`/projects/${json.project.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="brand" to="/dashboard">
            <span className="pip" />
            <span className="brand-text">AI QA</span>
            <span className="brand-tag">New project</span>
          </Link>
          <div className="nav-cta">
            <Link className="btn btn-ghost btn-sm" to="/dashboard">
              Cancel
            </Link>
          </div>
        </div>
      </nav>

      <main className="app-main">
        <div className="wrap">
          <div className="app-head">
            <div>
              <h1>New <em>project</em></h1>
              <div className="count">Name it and point it at a URL — set up testing next</div>
            </div>
          </div>

          {error && <div className="alert">{error}</div>}

          <form className="form-card" onSubmit={handleSubmit}>
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

            <div className="form-actions">
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
