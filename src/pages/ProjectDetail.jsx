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

// Authenticated fetch against the API, attaching the current Supabase JWT.
async function api(path, options = {}) {
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

const emptyForm = () => ({ label: '', loginUrl: '', username: '', password: '', allowedDomains: '' });

// Per-project login credentials the test agent authenticates with. The password
// is write-only here — the server never sends it back, only `hasSecret`.
function ProfilesSection({ projectId }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);

  // Reusable fetch, called after every mutation to refresh the list.
  async function load() {
    const { profiles } = await api(`/projects/${projectId}/profiles`);
    setProfiles(profiles);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { profiles } = await api(`/projects/${projectId}/profiles`);
        if (active) setProfiles(profiles);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  }
  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      label: p.label,
      loginUrl: p.login_url || '',
      username: p.username,
      password: '', // never prefilled — blank means "keep existing"
      allowedDomains: (p.allowed_domains || []).join(', '),
    });
    setOpen(true);
  }
  function cancel() {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  }
  function set(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = {
        label: form.label,
        loginUrl: form.loginUrl,
        username: form.username,
        allowedDomains: form.allowedDomains,
      };
      // Only send a password when one was typed (required on create; on edit a
      // blank field leaves the stored secret untouched).
      if (form.password) body.password = form.password;

      if (editingId) {
        await api(`/projects/${projectId}/profiles/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        if (!form.password) throw new Error('Password is required.');
        await api(`/projects/${projectId}/profiles`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      cancel();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this login profile?')) return;
    setError('');
    try {
      await api(`/projects/${projectId}/profiles/${id}`, { method: 'DELETE' });
      setProfiles((p) => p.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="profiles">
      <div className="profiles-head">
        <div>
          <h2>Login <em>profiles</em></h2>
          <p className="muted">
            Credentials the agent uses to sign in before testing. Use a dedicated,
            low-privilege test account — passwords are encrypted at rest.
          </p>
        </div>
        {!open && (
          <button className="btn btn-ghost btn-sm" onClick={startAdd}>
            + Add profile
          </button>
        )}
      </div>

      {error && <div className="alert">{error}</div>}

      {open && (
        <form className="form-card profile-form" onSubmit={submit}>
          <h3>{editingId ? 'Edit profile' : 'New profile'}</h3>
          <label>
            Label *
            <input
              value={form.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Standard user"
              required
            />
          </label>
          <label>
            Login URL
            <input
              type="url"
              value={form.loginUrl}
              onChange={(e) => set({ loginUrl: e.target.value })}
              placeholder="https://example.com/login"
            />
          </label>
          <label>
            Username / email *
            <input
              value={form.username}
              onChange={(e) => set({ username: e.target.value })}
              required
            />
          </label>
          <label>
            Password {editingId ? '(leave blank to keep)' : '*'}
            <input
              type="password"
              value={form.password}
              onChange={(e) => set({ password: e.target.value })}
              placeholder={editingId ? '••••••••' : ''}
              autoComplete="new-password"
              required={!editingId}
            />
          </label>
          <label>
            Allowed domains (comma-separated)
            <input
              value={form.allowedDomains}
              onChange={(e) => set({ allowedDomains: e.target.value })}
              placeholder="example.com, app.example.com"
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={cancel}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add profile'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="muted profile-empty">Loading…</div>
      ) : profiles.length === 0 ? (
        !open && <div className="muted profile-empty">No login profiles yet.</div>
      ) : (
        <ul className="profile-list">
          {profiles.map((p) => (
            <li key={p.id} className="profile-row">
              <div className="pr-main">
                <div className="pr-top">
                  <span className="pr-label">{p.label}</span>
                  <span className={`status-badge st-${p.status}`}>{p.status}</span>
                </div>
                <div className="pr-meta">
                  <span className="mono">{p.username}</span>
                  {p.login_url && <span className="pr-url mono">{p.login_url}</span>}
                </div>
                {p.allowed_domains?.length > 0 && (
                  <div className="pr-domains">
                    {p.allowed_domains.map((d) => (
                      <span key={d} className="pill">{d}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="pr-actions">
                <button className="btn btn-ghost btn-sm" disabled title="Coming soon">
                  Test login
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>
                  Edit
                </button>
                <button className="btn btn-ghost btn-sm danger" onClick={() => remove(p.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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

              <ProfilesSection projectId={id} />
            </>
          )}
        </div>
      </main>
    </>
  );
}
