import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Public marketing page at "/". Client-facing, benefit-led copy — no implementation
// jargon. Modern SaaS look: dotted-grid + aurora gradients (styles live in index.css).

// Small inline SVG icons (Lucide-style, consistent 1.6 stroke). No emoji as icons.
const Icon = {
  sparkle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  ),
  pen: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" />
    </svg>
  ),
  compass: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h2v4H8zM14 11h2v6h-2z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m20 6-11 11-5-5" />
    </svg>
  ),
};

const FEATURES = [
  { icon: Icon.pen, title: 'No test scripts to write', body: 'Describe what matters in plain English. AI QA writes the tests and keeps them up to date for you.' },
  { icon: Icon.refresh, title: 'Tests that heal themselves', body: 'When your UI changes, your tests adapt. No more flaky suites or maintenance days.' },
  { icon: Icon.shield, title: 'Catches what slips through', body: 'When the product stops matching what you promised, you hear about it before your customers do.' },
  { icon: Icon.compass, title: 'Explores like a real user', body: 'An AI agent navigates your live app the way a customer would — across every screen and flow.' },
  { icon: Icon.clock, title: 'Always-on testing', body: 'Runs on every release and every night. Wake up to a clean report, not a production fire.' },
  { icon: Icon.report, title: 'Reports you can act on', body: 'Clear pass / fail with a replay of exactly what broke and where, so fixes take minutes.' },
];

const STEPS = [
  { n: '01', title: 'Connect your product', body: 'Add your site and tell us what it should do — paste your docs or describe your features in plain language.' },
  { n: '02', title: 'Let the agent work', body: 'AI QA explores your app, learns every flow, and turns your requirements into a living test suite — automatically.' },
  { n: '03', title: 'Ship with confidence', body: 'Get alerted the moment something breaks. Fix it before it ever reaches a customer.' },
];

const STATS = [
  { big: '90%+', lbl: 'of regressions caught before they reach production' },
  { big: '10×', lbl: 'faster to cover a product than writing tests by hand' },
  { big: '24/7', lbl: 'testing that runs on every release, day and night' },
  { big: 'Minutes', lbl: 'to go from sign-up to your first passing run' },
];

const FAQS = [
  { q: 'Do I need to write any code or test scripts?', a: 'No. You describe what your product should do in plain English — AI QA turns that into tests and maintains them as your app changes.' },
  { q: 'Will tests break every time we change the UI?', a: 'No. Tests are grounded in what a feature is meant to do, not in brittle selectors, so they adapt to redesigns and small UI changes on their own.' },
  { q: 'What kind of apps does it work with?', a: 'Any web product with a live URL. Point AI QA at your site and it discovers the pages and flows for you.' },
  { q: 'How fast can we get started?', a: 'Minutes. Create a project, add your URL and docs, and the agent maps your app and starts generating coverage right away.' },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="lp">
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="brand" to="/">
            <span className="pip" />
            <span className="brand-text">AI QA</span>
          </Link>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#why">Why AI QA</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="nav-cta">
            {user ? (
              <Link className="btn btn-primary" to="/dashboard">
                Dashboard <span className="btn-arrow">→</span>
              </Link>
            ) : (
              <>
                <Link className="btn btn-ghost" to="/login">Sign in</Link>
                <Link className="btn btn-primary" to="/signup">
                  Start free <span className="btn-arrow">→</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ---------- Hero ---------- */}
      <header className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="wrap hero-inner">
          <a className="badge" href="#features">
            <span className="badge-ic">{Icon.sparkle}</span>
            Agentic AI QA for fast-moving teams
            <span className="badge-arrow">→</span>
          </a>

          <h1>
            Ship faster. Catch the bugs your<br className="hide-sm" /> customers would have found.
          </h1>

          <p className="hero-sub">
            AI QA reads your product, explores it like a real user, and turns every feature
            into a test — so nothing broken slips into production. No test scripts, no QA
            backlog, no surprises on launch day.
          </p>

          <div className="hero-cta">
            <Link className="btn btn-primary btn-lg" to={user ? '/dashboard' : '/signup'}>
              {user ? 'Open dashboard' : 'Start free'} <span className="btn-arrow">→</span>
            </Link>
            <Link className="btn btn-ghost btn-lg" to="/login">Book a demo</Link>
          </div>
          <p className="hero-meta">No credit card required · Set up in minutes</p>

          {/* product preview mock */}
          <div className="hero-mock">
            <div className="mock-bar">
              <span className="dot" /><span className="dot" /><span className="dot" />
              <span className="mock-url">app.aiqa.dev/runs/latest</span>
            </div>
            <div className="mock-body">
              <div className="mock-row">
                <span className="mock-status ok">{Icon.check} Passed</span>
                <span className="mock-name">Checkout flow — apply discount code</span>
                <span className="mock-time">2.1s</span>
              </div>
              <div className="mock-row">
                <span className="mock-status ok">{Icon.check} Passed</span>
                <span className="mock-name">Sign up → verify email → onboarding</span>
                <span className="mock-time">4.8s</span>
              </div>
              <div className="mock-row fail">
                <span className="mock-status bad">! Failed</span>
                <span className="mock-name">Reset password sends the wrong link</span>
                <span className="mock-time">1.4s</span>
              </div>
              <div className="mock-row">
                <span className="mock-status ok">{Icon.check} Passed</span>
                <span className="mock-name">Dashboard loads for returning user</span>
                <span className="mock-time">0.9s</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- Social proof ---------- */}
      <section className="proof">
        <div className="wrap">
          <p className="proof-label">Built for teams that ship to real customers</p>
          <div className="logo-row" aria-hidden="true">
            <span className="logo-item">Northwind</span>
            <span className="logo-item">Lumen</span>
            <span className="logo-item">Cobalt</span>
            <span className="logo-item">Helios</span>
            <span className="logo-item">Vantage</span>
            <span className="logo-item">Orbital</span>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="section" id="features">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Why teams switch</span>
            <h2>Everything you need to <em>stop shipping bugs</em>.</h2>
            <p className="section-blurb">
              Quality assurance that keeps pace with how fast you build — without growing
              your QA team or your maintenance backlog.
            </p>
          </div>

          <div className="feature-grid">
            {FEATURES.map((f) => (
              <article className="feature-card" key={f.title}>
                <span className="feature-ic">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Stats band ---------- */}
      <section className="stats-band">
        <div className="stats-glow" aria-hidden="true" />
        <div className="wrap">
          <div className="stats-grid">
            {STATS.map((s) => (
              <div className="stat" key={s.lbl}>
                <div className="stat-big">{s.big}</div>
                <div className="stat-lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="section" id="how">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">How it works</span>
            <h2>Live coverage in <em>three steps</em>.</h2>
            <p className="section-blurb">
              No setup project, no scripting sprint. You bring the product; AI QA does the rest.
            </p>
          </div>

          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.n}>
                <span className="step-num">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Why it works (comparison) ---------- */}
      <section className="section" id="why">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Why AI QA</span>
            <h2>Manual QA tests what someone <em>remembered</em>.</h2>
            <p className="section-blurb">
              Hand-written test suites rot the moment your product moves on. AI QA stays in
              step with what you actually shipped.
            </p>
          </div>

          <div className="compare">
            <div className="compare-col them">
              <div className="compare-label">The old way</div>
              <h3>Manual &amp; hand-written tests</h3>
              <ul>
                <li>Someone has to know every flow to cover it</li>
                <li>Tests go stale and silently stop catching bugs</li>
                <li>Coverage is whatever there was time for</li>
                <li>Every release is a leap of faith</li>
              </ul>
            </div>
            <div className="compare-col us">
              <div className="compare-label">With AI QA</div>
              <h3>An AI agent that never forgets</h3>
              <ul>
                <li>{Icon.check} Your product is the source of truth, not tribal memory</li>
                <li>{Icon.check} Tests adapt automatically as the app changes</li>
                <li>{Icon.check} Every feature you describe becomes coverage</li>
                <li>{Icon.check} You hear about breakage before your users do</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Testimonial ---------- */}
      <section className="section">
        <div className="wrap">
          <figure className="quote">
            <blockquote>
              &ldquo;We replaced days of manual regression testing with a report waiting for
              us every morning. AI QA catches the things our team would only find in
              production.&rdquo;
            </blockquote>
            <figcaption>
              <span className="quote-avatar" aria-hidden="true" />
              <span className="quote-who">
                <strong>Engineering Lead</strong>
                <span>Series-A SaaS company</span>
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="section" id="faq">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">FAQ</span>
            <h2>Questions, <em>answered</em>.</h2>
          </div>
          <div className="faq">
            {FAQS.map((f) => (
              <details className="faq-item" key={f.q}>
                <summary>
                  {f.q}
                  <span className="faq-mark" aria-hidden="true" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="cta" id="start">
        <div className="cta-card">
          <div className="cta-glow" aria-hidden="true" />
          <h2>Stop finding bugs in production.</h2>
          <p>
            Spin up a project, point AI QA at your product, and let the agent guard every
            release for you.
          </p>
          <div className="cta-actions">
            <Link className="btn btn-primary btn-lg" to={user ? '/dashboard' : '/signup'}>
              {user ? 'Open dashboard' : 'Start free'} <span className="btn-arrow">→</span>
            </Link>
            <Link className="btn btn-ghost-light btn-lg" to="/login">Sign in</Link>
          </div>
          <p className="cta-meta">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        <div className="wrap footer-inner">
          <div className="footer-brand">
            <span className="brand">
              <span className="pip" />
              <span className="brand-text">AI QA</span>
            </span>
            <p>Ship faster. Catch bugs before your customers do.</p>
          </div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#why">Why AI QA</a>
            <a href="#faq">FAQ</a>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© {new Date().getFullYear()} AI QA. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
