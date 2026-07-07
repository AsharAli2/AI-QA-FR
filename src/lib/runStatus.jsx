// Status badge for a flow run row. Lives outside the page components so both
// the project tables and the run detail page share one rendering.
export function runStatusBadge(run) {
  if (!run) return <span className="status-badge st-untested">Not run</span>;
  if (run.status === 'running') return <span className="status-badge st-running">Running</span>;
  if (run.status === 'error') return <span className="status-badge st-error">Error</span>;
  return run.passed ? (
    <span className="status-badge st-valid">Passed</span>
  ) : (
    <span className="status-badge st-invalid">Failed</span>
  );
}
