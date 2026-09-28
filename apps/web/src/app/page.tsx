import { ArrowRight, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";

const API =
  process.env.API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://rojgaarmitra.vercel.app"
    : "http://localhost:4000");

type HomeJob = {
  id: string;
  title: string;
  organization: string;
  category: string;
  link: string;
  url: string;
  source: "OFFICIAL";
  publishedAt: string | null;
};

type LiveSource = {
  organization: string;
  category: string;
  url: string;
  connected: boolean;
};

async function getHomeContent(): Promise<{
  jobs: HomeJob[];
  sources: LiveSource[];
}> {
  try {
    const response = await fetch(`${API}/api/v1/live-jobs`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) return { jobs: [], sources: [] };

    const payload = await response.json();

    return {
      jobs: Array.isArray(payload.data) ? payload.data : [],
      sources: Array.isArray(payload.sources) ? payload.sources : [],
    };
  } catch {
    return { jobs: [], sources: [] };
  }
}

function JobCard({ job }: { job: HomeJob }) {
  return (
    <article className="job-card">
      <div className="job-card-top">
        <div className="org">
          <div className="org-icon">
            {job.organization.slice(0, 3).toUpperCase()}
          </div>
          <div>
            <b style={{ fontSize: 12 }}>{job.organization}</b>
            <small>{job.category}</small>
          </div>
        </div>
        <span className="pill">LIVE OFFICIAL</span>
      </div>

      <h3>{job.title}</h3>

      <div className="job-meta">
        <span className="tag">Official source</span>
        <span className="tag">{job.category}</span>
      </div>

      <div className="job-foot">
        <span>
          <ShieldCheck
            size={13}
            style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}
          />
          Live source
        </span>

        <a
          className="link"
          href={job.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open notice{" "}
          <ChevronRight
            size={14}
            style={{ display: "inline", verticalAlign: "middle" }}
          />
        </a>
      </div>
    </article>
  );
}

export default async function HomePage() {
  const { jobs, sources } = await getHomeContent();

  return (
    <>
      <header className="header">
        <div className="container header-in">
          <a href="/" className="brand" aria-label="RojgaarMitra home">
            <span className="brand-mark">RM</span>
            RojgaarMitra
          </a>

          <nav className="nav">
            <a href="#jobs">Latest Jobs</a>
            <a href="#sources">Official Sources</a>
            <a href="#how-it-works">How it works</a>
          </nav>

          <a className="btn btn-primary" href="#jobs">
            Browse Jobs <ArrowRight size={15} />
          </a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="eyebrow">
                <Sparkles size={14} /> Live government recruitment sources
              </span>

              <h1>Government jobs from official sources, in one place.</h1>

              <p>
                RojgaarMitra reads recruitment notices from official government,
                PSU, banking, defence and state recruitment websites. Always
                verify the original notification before applying.
              </p>

              <a className="btn btn-primary" href="#jobs">
                View live jobs <ArrowRight size={15} />
              </a>
            </div>

            <div className="hero-card">
              <div className="card-top">
                <div className="avatar">
                  <ShieldCheck size={20} />
                </div>
                <span className="pill">OFFICIAL DATA</span>
              </div>

              <h3>Live recruitment feed</h3>
              <p>Notices collected from official recruitment websites.</p>

              <div className="match-row">
                <span>Live notices</span>
                <b>{jobs.length}</b>
              </div>

              <div className="match-row">
                <span>Connected sources</span>
                <b>{sources.filter((source) => source.connected).length}</b>
              </div>

              <div className="hero-card-foot">
                <ShieldCheck
                  size={14}
                  style={{ verticalAlign: "middle", marginRight: 5 }}
                />
                Source links point to official websites.
              </div>
            </div>
          </div>
        </section>

        <section className="trust-strip">
          <div className="container trust-in">
            <span><ShieldCheck size={15} /> Official source links</span>
            <span><ShieldCheck size={15} /> No invented vacancies</span>
            <span><ShieldCheck size={15} /> Central + State coverage</span>
          </div>
        </section>

        <section className="section" id="jobs">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Latest live recruitment notices</h2>
                <p>Official-source notices only.</p>
              </div>
              <span className="link">{jobs.length} notices</span>
            </div>

            {jobs.length > 0 ? (
              <div className="job-grid">
                {jobs.slice(0, 30).map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <div className="update-card">
                <h3>No live notices were returned.</h3>
                <p>
                  Official source websites may be temporarily unavailable.
                  RojgaarMitra does not invent vacancy data.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="section" id="sources">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Official recruitment sources</h2>
                <p>Open the original government or recruitment website.</p>
              </div>
            </div>

            <div className="category-grid">
              {sources.map((source) => (
                <a
                  className="category"
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={source.organization}
                >
                  <span className="category-icon">
                    <ShieldCheck size={17} />
                  </span>
                  <span>
                    {source.organization}
                    <small style={{ display: "block", marginTop: 4 }}>
                      {source.connected ? "Connected" : "Unavailable"}
                    </small>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="how-it-works">
          <div className="container">
            <div className="banner">
              <div>
                <h3>How RojgaarMitra works</h3>
                <p>
                  Official website → live source reader → recruitment notice →
                  original notification. Verify the official notification for
                  eligibility, dates and application instructions.
                </p>
              </div>

              <a className="btn btn-primary" href="#jobs">
                See notices <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-in">
          <div>
            <div className="brand">
              <span className="brand-mark">RM</span>
              RojgaarMitra
            </div>
            <small>
              Government recruitment information from official sources.
            </small>
          </div>
          <small>Always verify the original recruitment notification.</small>
        </div>
      </footer>
    </>
  );
}
