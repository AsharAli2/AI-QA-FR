import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Public marketing page at "/". Reuses the editorial design system (paper/ink/
// paprika, Goudy serif). The nav adapts to whether the visitor is signed in.
export default function Landing() {
  const { user } = useAuth();

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="brand" to="/">
            <span className="pip" />
            <span className="brand-text">AI QA</span>
            <span className="brand-tag">Autonomous testing</span>
          </Link>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#why">Why it works</a>
            <a href="#start">Get started</a>
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
        <div className="wrap">
          <div className="hero-eyebrow-row">
            <span className="pip" />
            <span className="eyebrow">Docs in · Tested product out</span>
          </div>
          <h1>
            Your docs describe the product.<br />
            We make sure the product <em>agrees</em>.
          </h1>
          <div className="hero-sub-row">
            <div className="hero-sub-stack">
              <p className="hero-sub">
                Upload your product documentation. An AI agent reads the <strong>features
                and rules</strong>, crawls your live site to <strong>discover every
                route</strong>, and turns the gap between the two into tests — so a
                feature that drifts from its spec doesn&rsquo;t ship quietly.
              </p>
            </div>
            <div className="hero-cta">
              <Link className="btn btn-primary" to={user ? '/dashboard' : '/signup'}>
                {user ? 'Open dashboard' : 'Start free'} <span className="btn-arrow">→</span>
              </Link>
              <Link className="btn btn-ghost" to="/login">Sign in</Link>
              <span className="meta">No credit card · Bring your own docs</span>
            </div>
          </div>

          {/* product-mock stat chips */}
          <div className="overlay-row">
            <div className="overlay-chip">
              <span className="k">Documents</span>
              <span className="v">Specs &amp; <em>flows</em></span>
              <span className="sub">Structured into features + rules</span>
            </div>
            <div className="overlay-chip">
              <span className="k">Embeddings</span>
              <span className="v"><em>RAG</em></span>
              <span className="sub">Semantic recall over every rule</span>
            </div>
            <div className="overlay-chip">
              <span className="k">Routes</span>
              <span className="v"><em>Crawled</em></span>
              <span className="sub">Discovered live by the agent</span>
            </div>
            <div className="overlay-chip">
              <span className="k">Coverage</span>
              <span className="v">Spec → <em>test</em></span>
              <span className="sub">Generated where rules meet routes</span>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- How it works ---------- */}
      <section className="section" id="how">
        <div className="wrap">
          <div className="section-eyebrow">
            <span className="section-num">01</span>
            <span className="section-name">How it works</span>
          </div>
          <h2>Three moves, from <em>prose</em> to proof.</h2>
          <p className="section-blurb">
            No test scripts to write by hand. You bring the docs; the pipeline does the
            structuring, the crawling, and the matching.
          </p>

          <div className="steps">
            <div className="step">
              <span className="num">STEP 01</span>
              <h3><em>Ingest</em> the docs</h3>
              <p>
                Paste text or upload PDFs. An LLM structures the prose into discrete
                features and business rules, then embeds each one for semantic recall.
              </p>
              <span className="step-tag">Features · Rules · pgvector</span>
            </div>
            <div className="step">
              <span className="num">STEP 02</span>
              <h3><em>Discover</em> the routes</h3>
              <p>
                A LangGraph browser agent opens your site, snapshots each page, follows
                real links, and records every distinct route it can reach.
              </p>
              <span className="step-tag">Live crawl · No scripts</span>
            </div>
            <div className="step">
              <span className="num">STEP 03</span>
              <h3><em>Generate</em> the tests</h3>
              <p>
                Where a discovered route meets the rules that govern it, the agent drafts
                tests — turning &ldquo;the spec says X&rdquo; into something that fails loudly when X breaks.
              </p>
              <span className="step-tag">Spec-grounded coverage</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Why it works (dark band) ---------- */}
      <section className="section manifesto" id="why">
        <div className="wrap">
          <div className="section-eyebrow">
            <span className="section-num">02</span>
            <span className="section-name">Why it works</span>
          </div>
          <h2>Manual QA tests what someone <em>remembered</em>. We test the spec.</h2>
          <p className="section-blurb">
            Test suites rot because they&rsquo;re written once and forgotten. Grounding tests in
            the documentation keeps them honest as the product changes.
          </p>

          <div className="compare">
            <div className="compare-col them">
              <div className="label">The usual way</div>
              <h3>Hand-written suites</h3>
              <ul>
                <li>Someone has to know every flow to test it</li>
                <li>Routes drift; tests silently go stale</li>
                <li>Coverage is whatever there was time for</li>
                <li>The spec and the suite never actually meet</li>
              </ul>
            </div>
            <div className="compare-col us">
              <div className="label">With AI QA</div>
              <h3>Spec-<em>grounded</em> agent</h3>
              <ul>
                <li>Docs are the source of truth, not tribal memory</li>
                <li>Routes are re-discovered from the live site</li>
                <li>Every rule is a candidate for a test</li>
                <li>Drift between spec and product surfaces fast</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Stats ---------- */}
      <section className="section">
        <div className="wrap">
          <div className="section-eyebrow">
            <span className="section-num">03</span>
            <span className="section-name">The shape of it</span>
          </div>
          <h2>Built on a pipeline you can <em>reason about</em>.</h2>
          <div className="stats">
            <div className="stat">
              <div className="big"><em>3</em> stores</div>
              <div className="lbl">Raw docs, structured features, and a vector index — each with one clear job.</div>
            </div>
            <div className="stat">
              <div className="big"><em>1</em> agent</div>
              <div className="lbl">A LangGraph loop that crawls the live site and records routes — no brittle selectors.</div>
            </div>
            <div className="stat">
              <div className="big"><em>RLS</em></div>
              <div className="lbl">Row-level security scopes every project to its owner; secrets never touch the client.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="cta" id="start">
        <div className="wrap">
          <h2>Point it at your docs.<br /><em>See what your product forgot.</em></h2>
          <p className="blurb">
            Create a project, drop in a spec, and let the agent map the gap between what you
            wrote and what you shipped.
          </p>
          <div className="cta-actions">
            <Link className="btn btn-primary" to={user ? '/dashboard' : '/signup'}>
              {user ? 'Open dashboard' : 'Start free'} <span className="btn-arrow">→</span>
            </Link>
            <Link className="btn btn-ghost" to="/login">Sign in</Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        <div className="wrap simple-footer">
          <p className="tagline">
            AI QA — <em>docs in, tested product out.</em>
          </p>
          <span className="footer-bottom">© {new Date().getFullYear()} AI QA</span>
        </div>
      </footer>
    </>
  );
}
