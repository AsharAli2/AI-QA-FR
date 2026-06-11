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
    <div className="page">
      <header className="topbar">
        <h1>Projects</h1>
        <div className="topbar-actions">
          <span className="muted">{user?.email}</span>
          <Link className="btn" to="/projects/new">
            + New project
          </Link>
          <button className="btn ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="empty">
          <p className="muted">No projects yet.</p>
          <Link className="btn" to="/projects/new">
            Create your first project
          </Link>
        </div>
      ) : (
        <ul className="list">
          {projects.map((p) => (
            <li key={p.id} className="list-item">
              <div>
                <strong>{p.name}</strong>
                {p.base_url && <div className="muted">{p.base_url}</div>}
              </div>
              <span className="muted">{new Date(p.created_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
