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
    </ProjectShell>
  );
}
