import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../lib/queries';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  // Cached — revisiting the dashboard renders instantly; creating a project
  // invalidates this query (CreateProject) so the new card appears.
  const { data, isLoading: loading, error: loadError } = useProjects();
  const projects = data ?? [];
  const error = loadError?.message || '';

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="brand" to="/">
            <span className="pip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M17 7H9M17 7v8" /></svg>
            </span>
            <span className="brand-text">Preflight</span>
            <span className="brand-tag">Dashboard</span>
          </Link>
          <div className="nav-cta">
            <span className="app-user">{user?.email}</span>
            <Link className="btn btn-primary btn-sm" to="/projects/new">
              + New project
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="app-main">
        <div className="wrap">
          <div className="app-head">
            <div>
              <h1>Your <em>projects</em></h1>
              <div className="count">
                {loading ? 'Loading…' : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
              </div>
            </div>
            <div className="app-actions">
              <Link className="btn btn-primary" to="/projects/new">
                + New project
              </Link>
            </div>
          </div>

          {error && <div className="alert">{error}</div>}

          {loading ? (
            <div className="center muted">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="empty">
              <span className="em-mark">&ldquo;</span>
              <p>No projects yet. Create one, point it at a URL, and choose how you want to test it.</p>
              <Link className="btn btn-primary" to="/projects/new">
                Create your first project <span className="btn-arrow">→</span>
              </Link>
            </div>
          ) : (
            <div className="proj-grid">
              {projects.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="proj-card">
                  <div className="pc-top">
                    <h3>{p.name}</h3>
                    <span className="pc-date">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {p.base_url ? (
                    <span className="pc-url">{p.base_url}</span>
                  ) : (
                    <span className="pc-url none">No base URL — add one to crawl</span>
                  )}
                  <div className="pc-foot">
                    <span className="pc-open">
                      Open <span className="btn-arrow">→</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
