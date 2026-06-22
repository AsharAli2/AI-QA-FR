import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // RLS scopes this to the current user automatically.
    supabase
      .from('projects')
      .select('id, name, base_url, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setProjects(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="brand" to="/">
            <span className="pip" />
            <span className="brand-text">AI QA</span>
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
