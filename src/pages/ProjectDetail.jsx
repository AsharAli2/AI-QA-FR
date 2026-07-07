import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { keys, useFlows, useProfiles, useProject, useRuns } from '../lib/queries';
import ProjectShell from '../components/ProjectShell';
import { runStatusBadge } from '../lib/runStatus';

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
const fmtDuration = (run) => {
  if (!run?.started_at || !run?.finished_at) return '—';
  const s = Math.round((new Date(run.finished_at) - new Date(run.started_at)) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

// Row action menu (Edit / Delete, etc.) shown behind a vertical-dot trigger.
// Closes on outside click.
function KebabMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="kebab" ref={ref}>
      <button
        type="button"
        className="kebab-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Row actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>
      {open && (
        <div className="kebab-menu" role="menu">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`kebab-item ${it.danger ? 'danger' : ''}`}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Generic "are you sure" modal for destructive actions.
function ConfirmModal({ title, message, confirmLabel = 'Delete', busy, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-confirm">
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-x" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted">{message}</p>
        <div className="form-actions" style={{ gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flows — table of saved flows + create/edit modal
// ---------------------------------------------------------------------------

// Create/edit a flow: name + plain-language instructions + optional login profile.
function FlowModal({ projectId, profiles, flow, onClose, onSaved }) {
  const [name, setName] = useState(flow?.name || '');
  const [content, setContent] = useState(flow?.flow_content || '');
  const [profileId, setProfileId] = useState(flow?.profile_id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { name, flowContent: content, profileId: profileId || null };
      if (flow) {
        await api(`/projects/${projectId}/flows/${flow.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api(`/projects/${projectId}/flows`, { method: 'POST', body: JSON.stringify({ ...body, runNow: false }) });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={save}>
        <div className="modal-head">
          <h2>{flow ? 'Edit Test Flow' : 'Create Test Flow'}</h2>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="alert">{error}</div>}

        <label>
          Flow name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Look up train schedule" />
        </label>

        <label>
          Test instructions *
          <textarea
            rows={7}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={'Go to "Book" and find trains for May 12th from Washington DC to New York City. Ensure that the schedule loads correctly.'}
          />
        </label>

        <label>
          Login profile
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">None — run logged out</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.username})
              </option>
            ))}
          </select>
        </label>

        <div className="form-actions" style={{ gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !content.trim()}>
            {busy ? 'Saving…' : flow ? 'Save Changes' : 'Create Flow'}
          </button>
        </div>
      </form>
    </div>
  );
}

function FlowsView({ project }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Cached reads (direct Supabase / API) — instant on revisits; mutations below
  // invalidate exactly what they change.
  const { data: flowsData, isLoading: flowsLoading } = useFlows(project.id);
  const { data: runsData } = useRuns(project.id);
  const { data: profilesData } = useProfiles(project.id);
  const flows = flowsData ?? [];
  const runs = runsData ?? [];
  const profiles = profilesData ?? [];
  const loading = flowsLoading;

  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | { flow: null } (create) | { flow } (edit)
  const [confirmDelete, setConfirmDelete] = useState(null); // flow pending delete confirmation
  const [deleting, setDeleting] = useState(false);

  // Latest run per flow (the runs list is newest-first).
  const latestByFlow = {};
  for (const r of runs) if (!latestByFlow[r.flow_id]) latestByFlow[r.flow_id] = r;

  const q = search.trim().toLowerCase();
  const visible = q
    ? flows.filter((f) => (f.name || f.flow_content).toLowerCase().includes(q))
    : flows;

  async function confirmedDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api(`/projects/${project.id}/flows/${confirmDelete.id}`, { method: 'DELETE' });
      // The flow and (via cascade) its runs are gone — refresh both caches.
      queryClient.invalidateQueries({ queryKey: keys.flows(project.id) });
      queryClient.invalidateQueries({ queryKey: keys.runs(project.id) });
      setConfirmDelete(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Flows</h1>
          <p className="muted">
            Create and manage your automated flows. Flows are the “tests” you create to run on{' '}
            {project.base_url ? <span className="mono">{project.base_url}</span> : 'your site'}.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ flow: null })} disabled={!project.base_url}>
          + Create Flow
        </button>
      </div>

      {!project.base_url && <div className="alert">Set a base URL in Settings before running flows.</div>}
      {error && <div className="alert">{error}</div>}

      <input
        className="search-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search test flows…"
      />

      {loading ? (
        <p className="muted">Loading flows…</p>
      ) : visible.length === 0 ? (
        <div className="empty" style={{ padding: '48px 32px' }}>
          <p>{flows.length === 0 ? 'No flows yet — create your first test flow.' : 'No flows match your search.'}</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Profile</th>
                <th>Latest Status</th>
                <th>Last Run</th>
                <th className="tbl-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => {
                const latest = latestByFlow[f.id];
                const profile = profiles.find((p) => p.id === f.profile_id);
                return (
                  <tr key={f.id}>
                    <td className="tbl-name">{f.name || f.flow_content.split('\n')[0]}</td>
                    <td>{profile ? <span className="pill">@{profile.label}</span> : <span className="muted">logged-out</span>}</td>
                    <td>{runStatusBadge(latest)}</td>
                    <td className="muted">{latest ? fmtWhen(latest.started_at) : 'Never'}</td>
                    <td className="tbl-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={!project.base_url}
                        onClick={() => navigate(`/projects/${project.id}/runs/new?flow=${f.id}`)}
                      >
                        ▶ Run Flow
                      </button>
                      <KebabMenu
                        items={[
                          { label: 'Edit', onClick: () => setModal({ flow: f }) },
                          { label: 'Delete', danger: true, onClick: () => setConfirmDelete(f) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <FlowModal
          projectId={project.id}
          profiles={profiles}
          flow={modal.flow}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            queryClient.invalidateQueries({ queryKey: keys.flows(project.id) });
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete flow?"
          message={`Delete "${confirmDelete.name || 'this flow'}" and all its runs? This can't be undone.`}
          busy={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmedDelete}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Runs — every run in the project; a row opens the run detail page
// ---------------------------------------------------------------------------

function RunsView({ project }) {
  const navigate = useNavigate();
  // Same cached query the Flows tab uses for "latest status" — switching tabs
  // does not refetch; finishing a run (RunDetail) invalidates it.
  const { data, isLoading: loading, error: loadError } = useRuns(project.id);
  const runs = data ?? [];
  const error = loadError?.message || '';

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Runs</h1>
          <p className="muted">Every flow execution, newest first. Open a run to see its steps and screenshots.</p>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <p className="muted">Loading runs…</p>
      ) : runs.length === 0 ? (
        <div className="empty" style={{ padding: '48px 32px' }}>
          <p>No runs yet — run a flow from the Flows tab.</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl tbl-click">
            <thead>
              <tr>
                <th>Flow</th>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Model calls</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/projects/${project.id}/runs/${r.id}`)}>
                  <td className="tbl-name">{r.flows?.name || r.flows?.flow_content?.split('\n')[0] || 'Flow'}</td>
                  <td>{runStatusBadge(r)}</td>
                  <td className="muted">{fmtWhen(r.started_at)}</td>
                  <td className="muted">{fmtDuration(r)}</td>
                  <td className="muted">{r.llm_calls ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Settings — base URL, route discovery, login profiles, documents
// ---------------------------------------------------------------------------

const emptyForm = () => ({ label: '', loginUrl: '', username: '', password: '', allowedDomains: '' });

// Per-project login credentials the test agent authenticates with. The password
// is write-only here — the server never sends it back, only `hasSecret`.
function ProfilesSection({ projectId }) {
  const queryClient = useQueryClient();
  // Profiles stay behind the API (the table carries the encrypted password);
  // the query just caches that API read. Mutations invalidate it.
  const { data, isLoading: loading, error: loadError } = useProfiles(projectId);
  const profiles = data ?? [];
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.profiles(projectId) });

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
      refresh();
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
      refresh();
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

      {(error || loadError) && <div className="alert">{error || loadError.message}</div>}

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

// Shared document-attach block. UI only for now — the upload/ingest wiring lands
// when we build the per-project document endpoint.
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

function SettingsView({ project }) {
  const [docFiles, setDocFiles] = useState([]);
  const [discovery, setDiscovery] = useState({ busy: false, result: null, error: '' });

  // Kick off route discovery on the server. Blocks until the crawl finishes
  // (tens of seconds), so we hold a busy state on the button.
  async function discover() {
    setDiscovery({ busy: true, result: null, error: '' });
    try {
      const json = await api(`/projects/${project.id}/discover`, { method: 'POST' });
      setDiscovery({ busy: false, result: json, error: '' });
    } catch (err) {
      setDiscovery({ busy: false, result: null, error: err.message });
    }
  }

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">
            Site under test:{' '}
            {project.base_url ? <span className="mono">{project.base_url}</span> : 'no base URL set'}
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="dc-step" style={{ padding: 0 }}>
          <div>
            <strong>Route discovery</strong>
            <p>Crawl {project.base_url || 'the site'} and save every page the agent finds.</p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={discover}
            disabled={!project.base_url || discovery.busy}
          >
            {discovery.busy ? 'Crawling…' : 'Discover routes'}
          </button>
        </div>
        {discovery.error && <div className="alert" style={{ marginTop: 16 }}>{discovery.error}</div>}
        {discovery.result && (
          <div style={{ marginTop: 16 }}>
            <span className="pc-result">
              {discovery.result.routes?.length ?? 0} found · {discovery.result.persisted ?? 0} saved
            </span>
            {discovery.result.routes?.length > 0 && (
              <ul className="route-list" style={{ marginTop: 10 }}>
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
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <ProfilesSection projectId={project.id} />
      </div>

      <div className="panel">
        <DocAttach
          files={docFiles}
          onAdd={(fs) => setDocFiles((p) => [...p, ...fs])}
          onRemove={(i) => setDocFiles((p) => p.filter((_, idx) => idx !== i))}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page — sidebar shell + the active view (?tab=runs|flows|settings)
// ---------------------------------------------------------------------------

export default function ProjectDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'flows';

  // Cached and shared with RunDetail — navigating between them never refetches.
  // RLS scopes the row to the owner; a non-owned id simply returns no row.
  const { data, isLoading: loading, error: loadError } = useProject(id);
  const project = data ?? null;
  const error = loadError?.message || '';

  if (loading) {
    return (
      <ProjectShell project={null} active={tab} onNav={(k) => setParams({ tab: k })}>
        <div className="center muted">Loading…</div>
      </ProjectShell>
    );
  }
  if (!project) {
    return (
      <ProjectShell project={null} active={tab} onNav={(k) => setParams({ tab: k })}>
        <div className="empty">
          <p>{error || 'Project not found.'}</p>
          <Link className="btn btn-primary" to="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </ProjectShell>
    );
  }

  return (
    <ProjectShell project={project} active={tab} onNav={(k) => setParams({ tab: k })}>
      {tab === 'runs' && <RunsView project={project} />}
      {tab === 'settings' && <SettingsView project={project} />}
      {tab !== 'runs' && tab !== 'settings' && <FlowsView project={project} />}
    </ProjectShell>
  );
}
