import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiStream } from '../lib/api';
import { keys, useFlows, useProject, useRun } from '../lib/queries';
import ProjectShell from '../components/ProjectShell';
import Markdown from '../components/Markdown';
import { runStatusBadge } from '../lib/runStatus';

// ---------------------------------------------------------------------------
// One page, two modes.
//   /projects/:id/runs/new?flow=<fid>  → START a run and stream it live (SSE)
//   /projects/:id/runs/<runId>         → load a finished run's stored report
// When a live run's id arrives we swap the URL in place (replace) — the
// component stays mounted and the stream keeps flowing.
// ---------------------------------------------------------------------------

// Normalize stored steps (result.steps — one row per tool call) into per-turn
// action cards: { turn, note, tools: [{ tool, ok, error }], }.
function actionsFromSteps(steps = []) {
  const actions = [];
  for (const s of steps) {
    let a = actions[actions.length - 1];
    if (!a || a.turn !== s.turn) {
      a = { turn: s.turn, note: '', tools: [] };
      actions.push(a);
    }
    if (s.note && !a.note) a.note = s.note;
    a.tools.push({ tool: s.tool, ok: s.ok, error: s.error });
  }
  return actions;
}

const prettyTool = (t) => (t || '').replace(/^browser_/, '').replace(/_/g, ' ');

// 42000 → "42s", 114000 → "1m 54s"
function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function ToolChip({ tool, running }) {
  const state =
    tool.ok === true ? 'ok' : tool.ok === false ? 'fail' : running ? 'busy' : 'skip';
  return (
    <span className={`tool-chip tc-${state}`} title={tool.error || ''}>
      {state === 'ok' && '✓ '}
      {state === 'fail' && '✕ '}
      {state === 'busy' && <span className="tc-spin" />}
      {prettyTool(tool.tool)}
    </span>
  );
}

// ---- Run report (finished runs): collapsible issues + network timings ------

function shortUrl(u = '') {
  let s = u;
  try {
    const { pathname, search } = new URL(u);
    s = pathname + search;
  } catch { /* keep raw */ }
  return s.length > 90 ? `${s.slice(0, 90)}…` : s;
}

const isFailed = (r) => r.status === 0 || r.status >= 400;

function Collapse({ title, count, children }) {
  if (!count) return null;
  return (
    <details className="rpt-group">
      <summary>
        <span className="rpt-chev" aria-hidden="true" />
        {title}
        <span className="rpt-count mono">{count}</span>
      </summary>
      <div className="rpt-body">{children}</div>
    </details>
  );
}

function RequestRow({ r }) {
  return (
    <div className="req-row" title={r.url}>
      <span className={`req-status mono ${isFailed(r) ? 'bad' : ''}`}>
        {r.status === 0 ? 'ERR' : (r.status ?? '—')}
      </span>
      <span className="req-method mono">{r.method || 'GET'}</span>
      <span className="req-url mono">{shortUrl(r.url)}</span>
      <span className="req-ms mono">{r.durationMs != null ? `${r.durationMs} ms` : ''}</span>
    </div>
  );
}

// Not a time-series (the report stores durations, not timestamps): a bar per
// request, slowest first, so the expensive calls surface immediately.
function NetworkBars({ requests }) {
  const rows = [...requests].sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));
  const max = Math.max(...rows.map((r) => r.durationMs || 0), 1);
  return (
    <div className="net-bars">
      {rows.map((r, i) => {
        const tone = isFailed(r) ? 'bad' : (r.durationMs || 0) > 3000 ? 'slow' : '';
        return (
          <div
            className="net-row"
            key={i}
            title={`${r.method || 'GET'} ${r.url} — ${r.durationMs ?? '?'} ms${isFailed(r) ? ` (status ${r.status})` : ''}`}
          >
            <span className="net-url mono">{shortUrl(r.url)}</span>
            <span className="net-track">
              <span
                className={`net-bar ${tone}`}
                style={{ width: `${Math.max(((r.durationMs || 0) / max) * 100, 2)}%` }}
              />
            </span>
            <span className="net-ms mono">
              {isFailed(r) && <b className="bad">{r.status === 0 ? 'ERR' : r.status} </b>}
              {r.durationMs != null ? `${r.durationMs} ms` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function RunDetail() {
  const { id, runId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [liveRun, setLiveRun] = useState(null); // run row as SSE reports it
  const [liveActions, setLiveActions] = useState([]);
  const [shots, setShots] = useState({}); // turn -> signed URL
  const [selectedTurn, setSelectedTurn] = useState(null); // null = follow latest
  const [error, setError] = useState('');

  // Fixed at mount: arriving at /runs/new makes THIS instance the live one — it
  // owns all state even after the URL swaps to /runs/<id> mid-run (same route
  // pattern, no remount), and the stored-run query stays off. `startedRef`
  // guards StrictMode's double-effect so the run starts only once.
  const [live] = useState(runId === 'new');
  const startedRef = useRef(false);
  const endRef = useRef(null);

  // Cached reads, shared with the project pages — navigating here refetches nothing.
  const { data: project } = useProject(id);
  const { data: flows } = useFlows(id); // live mode: the flow's name/instructions
  const { data: storedRun } = useRun(runId, { enabled: !live });

  const run = live ? liveRun : storedRun;
  const flowMeta = live
    ? (flows || []).find((f) => f.id === (params.get('flow') || liveRun?.flow_id))
    : storedRun?.flows;
  const storedActions = useMemo(() => actionsFromSteps(storedRun?.result?.steps ?? []), [storedRun]);
  const actions = live ? liveActions : storedActions;

  const running = run ? run.status === 'running' : runId === 'new';

  // Sign screenshot paths → { turn: url } (used by both modes).
  async function signShots(entries) {
    const paths = entries.map((e) => e.path);
    if (!paths.length) return {};
    const { urls } = await api(`/projects/${id}/screenshots/sign`, {
      method: 'POST',
      body: JSON.stringify({ paths }),
    });
    const map = {};
    for (const e of entries) if (urls[e.path]) map[e.turn] = urls[e.path];
    return map;
  }

  // ---- live mode: start the run and stream it -------------------------------
  useEffect(() => {
    if (!live || startedRef.current) return;
    startedRef.current = true;

    const flowId = params.get('flow');
    if (!flowId) return; // rendered as an error below without touching state

    const handle = (event, data) => {
      if (event === 'run') {
        setLiveRun(data.run);
        if (data.run.status === 'running') {
          // Run row created — give this page its real URL without remounting.
          navigate(`/projects/${id}/runs/${data.run.id}`, { replace: true });
        } else {
          // Terminal: the stored report is authoritative — swap in its steps
          // and sign any screenshots the live events may have missed. The runs
          // list cache is now stale (a new finished row exists).
          queryClient.invalidateQueries({ queryKey: keys.runs(id) });
          const steps = data.run.result?.steps ?? [];
          if (steps.length) setLiveActions(actionsFromSteps(steps));
          const entries = steps.filter((s) => s.screenshot).map((s) => ({ turn: s.turn, path: s.screenshot }));
          signShots(entries)
            .then((map) => setShots((s) => ({ ...s, ...map })))
            .catch(() => {});
        }
      } else if (event === 'turn') {
        setLiveActions((a) => [
          ...a,
          { turn: data.turn, note: data.note, tools: (data.toolCalls || []).map((c) => ({ tool: c.tool })) },
        ]);
      } else if (event === 'tool_result') {
        setLiveActions((a) =>
          a.map((act) => {
            if (act.turn !== data.turn) return act;
            const tools = [...act.tools];
            const i = tools.findIndex((t) => t.tool === data.tool && t.ok === undefined);
            if (i !== -1) tools[i] = { ...tools[i], ok: data.ok, error: data.error };
            return { ...act, tools };
          }),
        );
      } else if (event === 'screenshot') {
        signShots([{ turn: data.turn, path: data.path }])
          .then((map) => setShots((s) => ({ ...s, ...map })))
          .catch(() => {});
      } else if (event === 'error') {
        setError(data.message);
      }
    };

    apiStream(`/projects/${id}/flows/${flowId}/run`, { onEvent: handle }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // ---- finished mode: sign the stored report's screenshots ------------------
  // The run itself comes from the cached useRun query; only the signed URLs
  // (short-lived, so never cached) are fetched here.
  useEffect(() => {
    if (live || !storedRun) return;
    let active = true;
    const steps = storedRun.result?.steps ?? [];
    const entries = steps.filter((s) => s.screenshot).map((s) => ({ turn: s.turn, path: s.screenshot }));
    if (!entries.length) return;
    signShots(entries)
      .then((map) => active && setShots(map))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, storedRun]);

  // Follow the newest action while the run is live.
  useEffect(() => {
    if (running && selectedTurn === null) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [actions, running, selectedTurn]);

  // The screenshot to show: the selected turn's, else the latest one available.
  const shotTurns = Object.keys(shots).map(Number).sort((a, b) => a - b);
  const shownTurn = selectedTurn ?? shotTurns[shotTurns.length - 1] ?? null;
  const shownShot = shownTurn != null ? shots[shownTurn] : null;

  const issues = run?.result?.issues;
  const requests = run?.result?.network?.requests ?? [];
  const issueTotal = issues
    ? (issues.failedRequests?.length || 0) +
      (issues.slowRequests?.length || 0) +
      (issues.jsErrors?.length || 0) +
      (issues.security?.length || 0)
    : 0;
  const issueChips = issues
    ? [
        issues.failedRequests?.length && `${issues.failedRequests.length} failed request${issues.failedRequests.length > 1 ? 's' : ''}`,
        issues.slowRequests?.length && `${issues.slowRequests.length} slow request${issues.slowRequests.length > 1 ? 's' : ''}`,
        issues.jsErrors?.length && `${issues.jsErrors.length} JS error${issues.jsErrors.length > 1 ? 's' : ''}`,
        issues.security?.length && `${issues.security.length} security finding${issues.security.length > 1 ? 's' : ''}`,
      ].filter(Boolean)
    : [];

  return (
    <ProjectShell project={project} active="runs" onNav={(k) => navigate(`/projects/${id}?tab=${k}`)}>
      <button className="back-link" onClick={() => navigate(`/projects/${id}?tab=runs`)}>
        ← Return to Run Overview
      </button>

      <div className="run-head">
        <h1>{flowMeta?.name || flowMeta?.flow_content?.split('\n')[0] || 'Flow run'}</h1>
        {runStatusBadge(run ?? { status: 'running' })}
      </div>
      <p className="muted run-when">
        {run?.started_at ? new Date(run.started_at).toLocaleString() : 'starting…'}
        {run?.started_at && run?.finished_at &&
          ` · ${fmtDuration(new Date(run.finished_at) - new Date(run.started_at))}`}
        {run?.llm_calls != null && ` · ${run.llm_calls} model calls`}
      </p>

      {flowMeta?.flow_content && (
        <div className="panel run-instructions">
          <strong>Flow Instructions</strong>
          <p>{flowMeta.flow_content}</p>
        </div>
      )}

      {(error || (runId === 'new' && !params.get('flow'))) && (
        <div className="alert">{error || 'No flow specified.'}</div>
      )}

      {run && run.status !== 'running' && run.summary && (
        <div className={`alert ${run.passed ? 'success' : ''}`} style={{ marginTop: 16 }}>
          <b>{run.passed ? 'Passed' : run.status === 'error' ? 'Error' : 'Failed'}:</b>{' '}
          <Markdown inline>{run.summary}</Markdown>
          {issueChips.length > 0 && (
            <span className="issue-chips">
              {issueChips.map((c) => (
                <span key={c} className="pill">{c}</span>
              ))}
            </span>
          )}
        </div>
      )}

      <div className="run-layout">
        <section className="run-actions">
          <div className="run-actions-head">
            <h2>Agent Actions</h2>
            {running && (
              <span className="live-badge">
                <span className="live-dot" /> Live
              </span>
            )}
          </div>

          {actions.length === 0 && (
            <p className="muted" style={{ fontSize: 13 }}>
              {running ? 'Starting the browser…' : 'No recorded steps for this run.'}
            </p>
          )}

          <ol className="action-list">
            {actions.map((a) => (
              <li key={a.turn}>
                <button
                  className={`action-card ${shownTurn === a.turn ? 'selected' : ''} ${shots[a.turn] ? 'has-shot' : ''}`}
                  onClick={() => setSelectedTurn(a.turn === selectedTurn ? null : a.turn)}
                >
                  <span className="action-title">
                    <b>{a.turn}.</b>{' '}
                    {a.note ? (
                      <Markdown inline>{a.note}</Markdown>
                    ) : (
                      a.tools.map((t) => prettyTool(t.tool)).join(', ') || '…'
                    )}
                  </span>
                  {a.tools.length > 0 && (
                    <span className="action-tools">
                      {a.tools.map((t, i) => (
                        <ToolChip key={i} tool={t} running={running} />
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
          <div ref={endRef} />
        </section>

        <section className="run-shot">
          <div className="shot-frame">
            <div className="shot-bar">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              {shownTurn != null && <span className="shot-turn mono">step {shownTurn}</span>}
            </div>
            {shownShot ? (
              <div className="shot-scroll">
                <img src={shownShot} alt={`Screenshot after step ${shownTurn}`} />
              </div>
            ) : (
              <div className="shot-empty muted">
                {running ? 'Waiting for the first screenshot…' : 'No screenshot for this step.'}
              </div>
            )}
          </div>
          {selectedTurn !== null && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setSelectedTurn(null)}>
              {running ? 'Follow live' : 'Show latest'}
            </button>
          )}
        </section>
      </div>

      {run && run.status !== 'running' && run.result && (
        <section className="run-report">
          <h2>Report</h2>
          {issueTotal === 0 && (
            <p className="rpt-clean">✓ No issues detected — no failed requests, JS errors or security findings.</p>
          )}
          <Collapse title="Failed requests" count={issues?.failedRequests?.length}>
            {(issues?.failedRequests ?? []).map((r, i) => (
              <RequestRow key={i} r={r} />
            ))}
          </Collapse>
          <Collapse title="Slow requests (over 3s)" count={issues?.slowRequests?.length}>
            {(issues?.slowRequests ?? []).map((r, i) => (
              <RequestRow key={i} r={r} />
            ))}
          </Collapse>
          <Collapse title="JS errors" count={issues?.jsErrors?.length}>
            {(issues?.jsErrors ?? []).map((e, i) => (
              <div key={i} className="err-row mono">{e}</div>
            ))}
          </Collapse>
          <Collapse title="Security findings" count={issues?.security?.length}>
            {(issues?.security ?? []).map((s, i) => (
              <div key={i} className="sec-row">
                <span className="pill">{s.type}</span>
                <span className="sec-detail mono">{s.detail}</span>
              </div>
            ))}
          </Collapse>
          <Collapse title="Network — response times" count={requests.length}>
            <NetworkBars requests={requests} />
          </Collapse>
        </section>
      )}
    </ProjectShell>
  );
}
