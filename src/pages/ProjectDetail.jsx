import { useEffect, useRef, useState } from 'react';
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
function ProfilesSection({ projectId, onCount }) {
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

  useEffect(() => {
    onCount?.(profiles.length);
  }, [profiles, onCount]);

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

// Shared typography so the highlight backdrop and the textarea wrap text identically.
const editorBase = {
  fontFamily: 'inherit',
  fontSize: 14,
  lineHeight: '1.6',
  padding: 12,
  border: '1px solid transparent',
  borderRadius: 10,
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 140,
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
};
const hl = {
  wrap: { position: 'relative' },
  backdrop: { ...editorBase, position: 'absolute', inset: 0, color: 'transparent', pointerEvents: 'none', overflow: 'auto', background: 'transparent', zIndex: 1 },
  textarea: { ...editorBase, position: 'relative', zIndex: 2, background: 'transparent', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', resize: 'vertical', outline: 'none', caretColor: 'currentColor', display: 'block' },
  mark: { background: 'rgba(124,108,255,.32)', color: 'transparent', borderRadius: 4, padding: '0 1px' },
  menu: { listStyle: 'none', margin: 0, padding: 4, position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, background: '#15151c', border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, maxHeight: 220, overflow: 'auto', boxShadow: '0 10px 28px rgba(0,0,0,.45)' },
  item: { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' },
  itemActive: { background: 'rgba(124,108,255,.18)' },
  itemLabel: { fontWeight: 600 },
  itemMeta: { opacity: 0.6, fontSize: 12 },
  foot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(124,108,255,.18)', border: '1px solid rgba(124,108,255,.4)', fontSize: 13 },
  chipX: { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 },
};

// Flow authoring with @-mention profile tagging. Type the flow in plain language;
// type "@" to tag a login profile — the agent runs the flow inside that profile's
// session. On Run we POST { flowContent, profileId? } to the backend.
function FlowComposer({ projectId, hasBaseUrl, onSaved }) {
  const [profiles, setProfiles] = useState([]);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState(null); // tagged login profile, or null = logged-out
  const [menu, setMenu] = useState({ open: false, query: '', at: -1, index: 0 });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  // The saved flow this composer is currently bound to, the snapshot it was saved
  // with, and its run history (newest first). While the text/profile match the
  // saved snapshot, "Run" re-runs the SAME flow (adds run #2, #3…); editing either
  // means the next run creates a NEW flow.
  const [flowId, setFlowId] = useState(null);
  const [savedText, setSavedText] = useState('');
  const [savedProfileId, setSavedProfileId] = useState(null);
  const [runs, setRuns] = useState([]);
  const taRef = useRef(null);
  const backdropRef = useRef(null);

  const profileId = selected?.id || null;
  const willRerun = flowId != null && text === savedText && profileId === savedProfileId;

  useEffect(() => {
    let active = true;
    api(`/projects/${projectId}/profiles`)
      .then(({ profiles }) => active && setProfiles(profiles))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [projectId]);

  const matches = menu.open
    ? profiles.filter((p) => p.label.toLowerCase().includes(menu.query.toLowerCase())).slice(0, 6)
    : [];

  // Find an active "@query" right before the caret (query may contain spaces).
  function detectMention(value, caret) {
    const upto = value.slice(0, caret);
    const at = upto.lastIndexOf('@');
    if (at === -1) return { open: false, query: '', at: -1, index: 0 };
    const before = at === 0 ? ' ' : upto[at - 1];
    const between = upto.slice(at + 1);
    if (!/\s/.test(before) || between.includes('\n')) return { open: false, query: '', at: -1, index: 0 };
    return { open: true, query: between, at, index: 0 };
  }

  function onChange(e) {
    setText(e.target.value);
    setMenu(detectMention(e.target.value, e.target.selectionStart));
  }

  function pick(profile) {
    const caret = taRef.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, menu.at)}@${profile.label} ${text.slice(caret)}`;
    setText(next);
    setSelected(profile);
    setMenu({ open: false, query: '', at: -1, index: 0 });
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function onKeyDown(e) {
    if (!menu.open || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMenu((m) => ({ ...m, index: (m.index + 1) % matches.length }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMenu((m) => ({ ...m, index: (m.index - 1 + matches.length) % matches.length }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(matches[menu.index] || matches[0]);
    } else if (e.key === 'Escape') {
      setMenu({ open: false, query: '', at: -1, index: 0 });
    }
  }

  function clearTag() {
    if (selected) setText((t) => t.split(`@${selected.label}`).join('').replace(/[ \t]{2,}/g, ' '));
    setSelected(null);
  }

  async function run() {
    setRunning(true);
    setError('');
    try {
      if (willRerun) {
        // Same flow, unchanged → re-run it: a new run row under the SAME flow.
        const { run } = await api(`/projects/${projectId}/flows/${flowId}/run`, { method: 'POST' });
        setRuns((r) => [run, ...r]);
      } else {
        // First run, or the text/profile changed → save a new flow and run it.
        const body = { flowContent: text };
        if (profileId) body.profileId = profileId;
        const { flow, run } = await api(`/projects/${projectId}/flows`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setFlowId(flow.id);
        setSavedText(text);
        setSavedProfileId(profileId);
        setRuns([run]);
        onSaved?.(); // a new flow now exists → refresh the saved-flows panel
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  // Render the tagged "@Label" highlighted behind the (transparent) textarea.
  function highlighted() {
    if (!selected) return text + '\n';
    const token = `@${selected.label}`;
    const parts = text.split(token);
    const out = [];
    parts.forEach((part, i) => {
      out.push(<span key={`p${i}`}>{part}</span>);
      if (i < parts.length - 1) out.push(<mark key={`m${i}`} style={hl.mark}>{token}</mark>);
    });
    out.push('\n');
    return out;
  }

  return (
    <>
      <div className="panel-head">
        <h2>Write your flow</h2>
        <p>
          Describe the test in plain language. Type <b>@</b> to tag a login profile — the flow runs
          inside that profile&apos;s session. No tag = logged-out.
        </p>
      </div>

      <div style={hl.wrap}>
        <div ref={backdropRef} style={hl.backdrop} aria-hidden="true">
          {highlighted()}
        </div>
        <textarea
          ref={taRef}
          style={hl.textarea}
          rows={6}
          placeholder={'e.g. Log in as @, go to /billing, and confirm the plan shows “Pro”.'}
          value={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onScroll={(e) => {
            if (backdropRef.current) backdropRef.current.scrollTop = e.target.scrollTop;
          }}
        />
        {menu.open && matches.length > 0 && (
          <ul style={hl.menu}>
            {matches.map((p, i) => (
              <li
                key={p.id}
                style={{ ...hl.item, ...(i === menu.index ? hl.itemActive : null) }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                onMouseEnter={() => setMenu((m) => ({ ...m, index: i }))}
              >
                <span style={hl.itemLabel}>{p.label}</span>
                <span style={hl.itemMeta}>{p.username}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={hl.foot}>
        {selected ? (
          <span style={hl.chip}>
            Runs as <b>@{selected.label}</b>
            <button type="button" onClick={clearTag} style={hl.chipX} aria-label="Remove profile">
              ✕
            </button>
          </span>
        ) : (
          <span className="muted" style={{ fontSize: 13 }}>
            No profile tagged · logged-out flow
          </span>
        )}
        <button
          className="btn btn-primary"
          onClick={run}
          disabled={running || !text.trim() || !hasBaseUrl}
          title={hasBaseUrl ? '' : 'Set a base URL first'}
        >
          {running ? 'Running…' : willRerun ? 'Run again' : 'Run flow'}
        </button>
      </div>

      {flowId && !willRerun && text.trim() && (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Flow edited — the next run will save a new flow (its run history starts fresh).
        </p>
      )}

      {error && <div className="alert">{error}</div>}

      {runs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Run history</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {runs.map((r, i) => (
              <li key={r.id} className="dc-result" style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b style={{ fontSize: 13 }}>Run #{runs.length - i}</b>
                  <span className={`status-badge st-${r.passed ? 'valid' : 'invalid'}`}>
                    {r.status === 'error' ? 'error' : r.passed ? 'passed' : 'failed'}
                  </span>
                  {r.finished_at && (
                    <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
                      {new Date(r.finished_at).toLocaleString()}
                    </span>
                  )}
                </div>
                {r.summary && <p style={{ margin: '8px 0 0' }}>{r.summary}</p>}
                {r.llm_calls != null && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    {r.llm_calls} model calls
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// A single run row, shared by the composer's live list and the saved-flows history.
function RunRow({ run, number }) {
  return (
    <li className="dc-result" style={{ padding: 12, listStyle: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {number != null && <b style={{ fontSize: 13 }}>Run #{number}</b>}
        <span className={`status-badge st-${run.passed ? 'valid' : 'invalid'}`}>
          {run.status === 'error' ? 'error' : run.passed ? 'passed' : 'failed'}
        </span>
        {(run.finished_at || run.started_at) && (
          <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
            {new Date(run.finished_at || run.started_at).toLocaleString()}
          </span>
        )}
      </div>
      {run.summary && <p style={{ margin: '8px 0 0' }}>{run.summary}</p>}
      {run.llm_calls != null && (
        <span className="muted" style={{ fontSize: 12 }}>
          {run.llm_calls} model calls
        </span>
      )}
    </li>
  );
}

// Persistent list of every flow saved for this project, with each flow's run
// history (lazy-loaded on expand) and a Run button that adds a new run. Reloads
// whenever `refreshKey` changes (the composer bumps it after saving a new flow).
function SavedFlows({ projectId, hasBaseUrl, refreshKey }) {
  const [flows, setFlows] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null); // flow id whose runs are shown
  const [runsByFlow, setRunsByFlow] = useState({}); // flowId -> run[] (newest first)
  const [busy, setBusy] = useState(null); // flow id currently re-running

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api(`/projects/${projectId}/flows`)
        .then((r) => r.flows)
        .catch(() => []),
      api(`/projects/${projectId}/profiles`)
        .then((r) => r.profiles)
        .catch(() => []),
    ]).then(([fl, pr]) => {
      if (!active) return;
      setFlows(fl || []);
      setProfiles(pr || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [projectId, refreshKey]);

  const labelFor = (pid) => profiles.find((p) => p.id === pid)?.label;

  async function loadRuns(fid) {
    try {
      const { runs } = await api(`/projects/${projectId}/flows/${fid}/runs`);
      setRunsByFlow((m) => ({ ...m, [fid]: runs || [] }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggle(fid) {
    if (expanded === fid) {
      setExpanded(null);
      return;
    }
    setExpanded(fid);
    if (!runsByFlow[fid]) await loadRuns(fid);
  }

  async function rerun(fid) {
    setBusy(fid);
    setError('');
    try {
      const { run } = await api(`/projects/${projectId}/flows/${fid}/run`, { method: 'POST' });
      setRunsByFlow((m) => ({ ...m, [fid]: [run, ...(m[fid] || [])] }));
      setExpanded(fid);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>Loading saved flows…</p>;
  if (flows.length === 0)
    return (
      <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
        No saved flows yet — run one above and it will appear here.
      </p>
    );

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Saved flows</h3>
      {error && <div className="alert">{error}</div>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        {flows.map((f) => {
          const runs = runsByFlow[f.id] || [];
          const open = expanded === f.id;
          const title = f.name || f.flow_content.split('\n')[0];
          return (
            <li key={f.id} className="dc-result" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title}
                  </strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {f.profile_id ? `@${labelFor(f.profile_id) || 'login profile'}` : 'logged-out'}
                    {f.created_at ? ` · saved ${new Date(f.created_at).toLocaleDateString()}` : ''}
                  </span>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={() => toggle(f.id)}
                  aria-expanded={open}
                  title="Show run history"
                >
                  {open ? 'Hide runs' : 'Runs'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => rerun(f.id)}
                  disabled={busy === f.id || !hasBaseUrl}
                  title={hasBaseUrl ? 'Run this flow again' : 'Set a base URL first'}
                >
                  {busy === f.id ? 'Running…' : 'Run'}
                </button>
              </div>

              {open && (
                <div style={{ marginTop: 12 }}>
                  {runs.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>No runs yet.</p>
                  ) : (
                    <ul style={{ padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                      {runs.map((r, i) => (
                        <RunRow key={r.id} run={r} number={runs.length - i} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The "Write your own flow" tab: the composer plus the persistent saved-flows
// panel. A version counter links them — saving a new flow refreshes the panel.
function FlowsTab({ projectId, hasBaseUrl }) {
  const [version, setVersion] = useState(0);
  return (
    <>
      <FlowComposer projectId={projectId} hasBaseUrl={hasBaseUrl} onSaved={() => setVersion((v) => v + 1)} />
      <SavedFlows projectId={projectId} hasBaseUrl={hasBaseUrl} refreshKey={version} />
    </>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user, signOut } = useAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Top-level page section — each is one click away, nothing requires scrolling.
  const [section, setSection] = useState('tests');
  const [profileCount, setProfileCount] = useState(null);

  // Within "Tests": 'custom' = user writes flows by hand · 'discover' = let the agent crawl + generate
  const [mode, setMode] = useState('discover');

  // --- AI discover (wired to POST /projects/:id/discover) ---
  const [docFiles, setDocFiles] = useState([]);
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
            <span className="pip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M17 7H9M17 7v8" /></svg>
            </span>
            <span className="brand-text">Preflight</span>
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
                Tell Preflight <em>what to test</em>
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

              {/* Section nav — every section is one click away, nothing lives below a scroll */}
              <div className="section-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={section === 'tests'}
                  className={`section-tab ${section === 'tests' ? 'active' : ''}`}
                  onClick={() => setSection('tests')}
                >
                  Tests
                </button>
                <button
                  role="tab"
                  aria-selected={section === 'profiles'}
                  className={`section-tab ${section === 'profiles' ? 'active' : ''}`}
                  onClick={() => setSection('profiles')}
                >
                  Login profiles
                  {profileCount != null && <span className="tab-count">{profileCount}</span>}
                </button>
                <button
                  role="tab"
                  aria-selected={section === 'docs'}
                  className={`section-tab ${section === 'docs' ? 'active' : ''}`}
                  onClick={() => setSection('docs')}
                >
                  Documents
                  {docFiles.length > 0 && <span className="tab-count">{docFiles.length}</span>}
                </button>
              </div>

              {section === 'tests' && (
                <>
                  <div className="segmented" role="tablist">
                    <button
                      role="tab"
                      aria-selected={mode === 'discover'}
                      className={`seg ${mode === 'discover' ? 'active' : ''}`}
                      onClick={() => setMode('discover')}
                    >
                      Let AI discover
                    </button>
                    <button
                      role="tab"
                      aria-selected={mode === 'custom'}
                      className={`seg ${mode === 'custom' ? 'active' : ''}`}
                      onClick={() => setMode('custom')}
                    >
                      Write your own flow
                    </button>
                  </div>

                  <div className="panel">
                    {mode === 'custom' ? (
                      <FlowsTab projectId={id} hasBaseUrl={!!project.base_url} />
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
                      </>
                    )}
                  </div>
                </>
              )}

              {section === 'profiles' && (
                <div className="panel">
                  <ProfilesSection projectId={id} onCount={setProfileCount} />
                </div>
              )}

              {section === 'docs' && (
                <div className="panel">
                  <DocAttach
                    files={docFiles}
                    onAdd={(fs) => setDocFiles((p) => [...p, ...fs])}
                    onRemove={(i) => setDocFiles((p) => p.filter((_, idx) => idx !== i))}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
