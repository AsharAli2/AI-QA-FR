import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// App shell for everything inside a project: fixed sidebar (Runs / Flows /
// Settings) + a main content area. `active` highlights the current section;
// `onNav(key)` is the parent's navigation (tab switch, or route back to the
// project page from a run detail).
const NAV = [
  {
    key: 'runs',
    label: 'Runs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l4 2" />
      </svg>
    ),
  },
  {
    key: 'flows',
    label: 'Flows',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 2v7.31" />
        <path d="M14 9.3V2" />
        <path d="M8.5 2h7" />
        <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

export default function ProjectShell({ project, active, onNav, children }) {
  const { user, signOut } = useAuth();
  return (
    <div className="shell">
      <aside className="shell-side">
        <Link className="brand shell-brand" to="/dashboard">
          <span className="pip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7M17 7H9M17 7v8" />
            </svg>
          </span>
          <span className="brand-text">Preflight</span>
        </Link>

        {project && (
          <div className="side-project" title={project.name}>
            <span className="side-project-name">{project.name}</span>
            {project.base_url && <span className="side-project-url mono">{project.base_url}</span>}
          </div>
        )}

        <nav className="side-nav">
          {NAV.map((item) => (
            <button
              key={item.key}
              className={`side-item ${active === item.key ? 'active' : ''}`}
              onClick={() => onNav(item.key)}
            >
              <span className="side-ic">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <span className="app-user">{user?.email}</span>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="shell-main">{children}</main>
    </div>
  );
}
