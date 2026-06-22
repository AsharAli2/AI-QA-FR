import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// Shared document-attach block, shown under both testing modes. UI only for now —
// the upload/ingest wiring lands when we build the per-project document endpoint.
function DocAttach({ files, onAdd, onRemove }) {
  return (
    <div className="attach">
      <div className="attach-head">
        <span className="attach-title">Attach docs</span>
        <span className="attach-note">Specs, flows, or notes to ground the tests — optional</span>
      </div>

      <label className="upload-zone">
        <input
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/plain"
          onChange={(e) => onAdd(Array.from(e.target.files ?? []))}
        />
        <span className="uz-icon">＋</span>
        <span className="uz-text">Click to add files</span>
        <span className="uz-sub">PDF, TXT, MD, CSV, JSON · up to 20 MB each</span>
      </label>

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={i} className="file-item">
              <span className="fi-name">{f.name}</span>
              <span className="fi-size">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" className="fi-x" onClick={() => onRemove(i)} aria-label="Remove">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user, signOut } = useAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 'custom' = user writes flows by hand · 'discover' = let the agent crawl + generate
  const [mode, setMode] = useState('discover');

  // --- Custom flow authoring (UI only; backend wiring later) ---
  const [flows, setFlows] = useState(['']);
  const [customFiles, setCustomFiles] = useState([]);

  // --- AI discover (wired to POST /projects/:id/discover) ---
  const [discoverFiles, setDiscoverFiles] = useState([]);
  const [discovery, setDiscovery] = useState({ busy: false, result: null, error: '' });

  useEffect(() => {
    // RLS scopes this to the owner; a non-owned id simply returns no row.
    supabase
      .from('projects')
      .select('id, name, base_url, settings, created_at')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setProject(data ?? null);
        setLoading(false);
      });
  }, [id]);

  function updateFlow(i, value) {
    setFlows((f) => f.map((v, idx) => (idx === i ? value : v)));
  }
  function addFlow() {
    setFlows((f) => [...f, '']);
  }
  function removeFlow(i) {
    setFlows((f) => (f.length === 1 ? [''] : f.filter((_, idx) => idx !== i)));
  }

  // Kick off route discovery on the server. Blocks until the crawl finishes
  // (tens of seconds), so we hold a busy state on the button.
  async function discover() {
    setDiscovery({ busy: true, result: null, error: '' });
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired — sign in again.');

      const res = await fetch(`${import.meta.env.VITE_API_URL}/projects/${id}/discover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Discovery failed');
      setDiscovery({ busy: false, result: json, error: '' });
    } catch (err) {
      setDiscovery({ busy: false, result: null, error: err.message });
    }
  }

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="brand" to="/dashboard">
            <span className="pip" />
            <span className="brand-text">AI QA</span>
            <span className="brand-tag">Project</span>
          </Link>
          <div className="nav-cta">
            <span className="app-user">{user?.email}</span>
            <Link className="btn btn-ghost btn-sm" to="/dashboard">
              Dashboard
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="app-main">
        <div className="wrap narrow">
          {loading ? (
            <div className="center muted">Loading…</div>
          ) : !project ? (
            <div className="empty">
              <span className="em-mark">&ldquo;</span>
              <p>{error || 'Project not found.'}</p>
              <Link className="btn btn-primary" to="/dashboard">
                Back to dashboard <span className="btn-arrow">→</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="crumb">
                <Link to="/dashboard">Projects</Link>
                <span className="crumb-sep">/</span>
                <span className="crumb-here">{project.name}</span>
              </div>

              <h1 className="detail-title">
                Tell AI QA <em>what to test</em>
              </h1>
              <p className="detail-sub">
                {project.base_url ? (
                  <>
                    Testing <span className="mono">{project.base_url}</span>. Write the flows
                    yourself, or let the agent discover them.
                  </>
                ) : (
                  <>
                    No base URL set for this project yet — add one to enable automatic discovery.
                  </>
                )}
              </p>

              {/* Mode switch */}
              <div className="tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={mode === 'custom'}
                  className={`tab ${mode === 'custom' ? 'active' : ''}`}
                  onClick={() => setMode('custom')}
                >
                  <span className="tab-k">Option 1</span>
                  <span className="tab-v">Write your own flow</span>
                </button>
                <button
                  role="tab"
                  aria-selected={mode === 'discover'}
                  className={`tab ${mode === 'discover' ? 'active' : ''}`}
                  onClick={() => setMode('discover')}
                >
                  <span className="tab-k">Option 2</span>
                  <span className="tab-v">Let AI discover</span>
                </button>
              </div>

              {/* Panel */}
              <div className="panel">
                {mode === 'custom' ? (
                  <>
                    <div className="panel-head">
                      <h2>Write your custom flows</h2>
                      <p>
                        Describe each test in plain language — one flow per box. The agent will
                        execute exactly these steps.
                      </p>
                    </div>

                    {flows.map((flow, i) => (
                      <div className="flow-row" key={i}>
                        <div className="flow-num">{String(i + 1).padStart(2, '0')}</div>
                        <textarea
                          rows={3}
                          placeholder={
                            'e.g. Go to /pricing, click “Start free”, fill the signup form, and confirm the dashboard loads.'
                          }
                          value={flow}
                          onChange={(e) => updateFlow(i, e.target.value)}
                        />
                        <button
                          type="button"
                          className="flow-x"
                          onClick={() => removeFlow(i)}
                          aria-label="Remove flow"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <button type="button" className="btn btn-ghost btn-sm" onClick={addFlow}>
                      + Add flow
                    </button>

                    <DocAttach
                      files={customFiles}
                      onAdd={(fs) => setCustomFiles((p) => [...p, ...fs])}
                      onRemove={(i) => setCustomFiles((p) => p.filter((_, idx) => idx !== i))}
                    />

                    <div className="panel-foot">
                      <span className="foot-note">Saving flows is coming soon.</span>
                      <button type="button" className="btn btn-primary" disabled title="Coming soon">
                        Save flows
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="panel-head">
                      <h2>Let AI discover</h2>
                      <p>
                        The agent crawls your site, maps its routes, and drafts test cases for each
                        one — no manual scripting.
                      </p>
                    </div>

                    <div className="discover-card">
                      <div className="dc-step">
                        <span className="dc-num">1</span>
                        <div>
                          <strong>Discover routes</strong>
                          <p>Crawl {project.base_url || 'the site'} and save every page it finds.</p>
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={discover}
                          disabled={!project.base_url || discovery.busy}
                          title={project.base_url ? 'Crawl the site' : 'Set a base URL first'}
                        >
                          {discovery.busy ? 'Crawling…' : 'Discover routes'}
                        </button>
                      </div>

                      {discovery.result && (
                        <div className="dc-result">
                          <span className="pc-result">
                            {discovery.result.routes?.length ?? 0} found ·{' '}
                            {discovery.result.persisted ?? 0} saved
                          </span>
                          {discovery.result.routes?.length > 0 && (
                            <ul className="route-list">
                              {discovery.result.routes.map((r, i) => (
                                <li key={i} className="route-item">
                                  <span className="ri-path mono">{r.path}</span>
                                  {r.title && <span className="ri-title">{r.title}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {discovery.error && <div className="alert">{discovery.error}</div>}

                      <div className="dc-step muted-step">
                        <span className="dc-num">2</span>
                        <div>
                          <strong>Generate test cases</strong>
                          <p>Draft tests for each discovered route. Coming soon.</p>
                        </div>
                        <button className="btn btn-ghost btn-sm" disabled title="Coming soon">
                          Generate
                        </button>
                      </div>
                    </div>

                    <DocAttach
                      files={discoverFiles}
                      onAdd={(fs) => setDiscoverFiles((p) => [...p, ...fs])}
                      onRemove={(i) => setDiscoverFiles((p) => p.filter((_, idx) => idx !== i))}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
