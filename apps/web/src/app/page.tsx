import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  Search,
  ShieldCheck,
  Trophy,
} from "lucide-react";

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
  vacancy?: number | null;
  qualification?: string | null;
  ageLimit?: string | null;
  applicationStart?: string | null;
  lastDate?: string | null;
  examDate?: string | null;
  notificationUrl?: string | null;
  applicationUrl?: string | null;
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

function JobRow({ job }: { job: HomeJob }) {
  return (
    <div className="result-row">
      <div>
        <a href={job.link} target="_blank" rel="noopener noreferrer" className="result-title">
          {job.title}
        </a>
        <div className="result-meta">
          <span>{job.organization}</span>
          <span>•</span>
          <span>{job.category}</span>
          {job.vacancy ? <><span>•</span><span>{job.vacancy.toLocaleString("en-IN")} Posts</span></> : null}
          <span>•</span>
          <span className="official-badge"><CheckCircle2 size={12} /> Official</span>
        </div>
        {(job.qualification || job.ageLimit || job.lastDate || job.examDate) ? (
          <div className="result-meta result-details">
            {job.qualification ? <span><b>Qualification:</b> {job.qualification}</span> : null}
            {job.ageLimit ? <span><b>Age:</b> {job.ageLimit}</span> : null}
            {job.lastDate ? <span><b>Last Date:</b> {job.lastDate}</span> : null}
            {job.examDate ? <span><b>Exam:</b> {job.examDate}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="result-actions">
        {job.notificationUrl ? <a href={job.notificationUrl} target="_blank" rel="noopener noreferrer" className="apply-link">Notification</a> : null}
        <a href={job.applicationUrl ?? job.link} target="_blank" rel="noopener noreferrer" className="apply-link">
          {job.applicationUrl ? "Apply" : "View"} <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}

function QuickCard({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <a href={href} className="quick-card">
      <span className="quick-icon">{icon}</span>
      <span>
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <ArrowRight size={16} />
    </a>
  );
}

export default async function HomePage() {
  const { jobs, sources } = await getHomeContent();
  const connectedSources = sources.filter((source) => source.connected).length;

  const qualificationLinks = [
    ["10th Pass", "#jobs"],
    ["12th Pass", "#jobs"],
    ["ITI", "#jobs"],
    ["Diploma", "#jobs"],
    ["Graduate", "#jobs"],
    ["Post Graduate", "#jobs"],
  ];

  const stateLinks = [
    ["All India", "#jobs"],
    ["Uttar Pradesh", "#jobs"],
    ["Maharashtra", "#jobs"],
    ["Bihar", "#jobs"],
    ["Rajasthan", "#jobs"],
    ["Madhya Pradesh", "#jobs"],
    ["Delhi", "#jobs"],
    ["Other States", "#jobs"],
  ];

  return (
    <>
      <div className="top-notice">
        <div className="container top-notice-in">
          <span>🔔 RojgaarMitra — Sarkari Naukri, Result, Admit Card & Answer Key</span>
          <span>Official source links only</span>
        </div>
      </div>

      <header className="classic-header">
        <div className="container">
          <div className="brand-area">
            <a href="/" className="classic-brand">
              <span className="brand-mark">RM</span>
              <span>
                <strong>ROJGAAR MITRA</strong>
                <small>Sarkari Naukri &amp; Results</small>
              </span>
            </a>

            <div className="header-stats">
              <span><b>{jobs.length}</b> Live Notices</span>
              <span><b>{connectedSources}</b> Sources</span>
            </div>
          </div>

          <nav className="classic-nav">
            <a href="/">Home</a>
            <a href="#jobs">Latest Jobs</a>
            <a href="#results">Results</a>
            <a href="#admit-card">Admit Card</a>
            <a href="#answer-key">Answer Key</a>
            <a href="#syllabus">Syllabus</a>
            <a href="#sources">Official Sources</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="portal-hero">
          <div className="container">
            <h1>Latest Sarkari Naukri, Government Jobs &amp; Results</h1>
            <p>Find recruitment notifications, results, admit cards, answer keys and official application links in one place.</p>

            <div className="portal-search">
              <Search size={20} />
              <input aria-label="Search government jobs" placeholder="Search SSC, UPSC, Railway, Banking, Police jobs..." />
              <button type="button">Search</button>
            </div>

            <div className="search-links">
              <a href="#jobs">Latest Jobs</a>
              <a href="#results">Latest Results</a>
              <a href="#admit-card">Admit Card</a>
              <a href="#answer-key">Answer Key</a>
            </div>
          </div>
        </section>

        <section className="quick-grid container">
          <QuickCard href="#jobs" icon={<ClipboardCheck size={22} />} title="Latest Jobs" text="New recruitment notices" />
          <QuickCard href="#results" icon={<Trophy size={22} />} title="Latest Result" text="Exam result updates" />
          <QuickCard href="#admit-card" icon={<FileCheck2 size={22} />} title="Admit Card" text="Hall ticket updates" />
          <QuickCard href="#answer-key" icon={<BookOpen size={22} />} title="Answer Key" text="Official answer keys" />
          <QuickCard href="#syllabus" icon={<GraduationCap size={22} />} title="Syllabus" text="Exam syllabus & pattern" />
          <QuickCard href="#calendar" icon={<CalendarDays size={22} />} title="Exam Calendar" text="Important exam dates" />
        </section>

        <section className="portal-section" id="jobs">
          <div className="container">
            <div className="section-title-bar">
              <h2>Latest Government Jobs</h2>
              <span>LIVE</span>
            </div>

            <div className="portal-panel">
              {jobs.length > 0 ? (
                jobs.slice(0, 40).map((job) => <JobRow key={job.id} job={job} />)
              ) : (
                <div className="empty-state">
                  <ShieldCheck size={24} />
                  <b>No live notices returned right now.</b>
                  <span>Official recruitment websites may be temporarily unavailable.</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="portal-section compact" id="results">
          <div className="container two-panels">
            <div>
              <div className="section-title-bar blue"><h2>Latest Results</h2><span>RESULT</span></div>
              <div className="portal-panel empty-panel">
                <div className="empty-state">
                  <Trophy size={22} />
                  <b>Result updates coming here</b>
                  <span>Only verified official result links will be published.</span>
                </div>
              </div>
            </div>

            <div id="admit-card">
              <div className="section-title-bar green"><h2>Latest Admit Card</h2><span>ADMIT</span></div>
              <div className="portal-panel empty-panel">
                <div className="empty-state">
                  <FileCheck2 size={22} />
                  <b>Admit card updates coming here</b>
                  <span>Links will point to the official examination portal.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="portal-section compact" id="answer-key">
          <div className="container two-panels">
            <div>
              <div className="section-title-bar orange"><h2>Latest Answer Key</h2><span>KEY</span></div>
              <div className="portal-panel empty-panel">
                <div className="empty-state">
                  <BookOpen size={22} />
                  <b>Answer key updates coming here</b>
                  <span>Official and provisional answer-key links only.</span>
                </div>
              </div>
            </div>

            <div id="syllabus">
              <div className="section-title-bar purple"><h2>Exam Syllabus</h2><span>SYLLABUS</span></div>
              <div className="portal-panel empty-panel">
                <div className="empty-state">
                  <GraduationCap size={22} />
                  <b>Syllabus updates coming here</b>
                  <span>Exam pattern and official syllabus links will appear here.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="portal-section" id="calendar">
          <div className="container">
            <div className="section-title-bar blue">
              <h2>Browse Government Jobs</h2>
              <span>EXPLORE</span>
            </div>

            <div className="browse-grid">
              <div className="browse-panel">
                <h3>By Qualification</h3>
                <div className="browse-links">
                  {qualificationLinks.map(([label, href]) => <a key={label} href={href}>{label} <Chevron /></a>)}
                </div>
              </div>

              <div className="browse-panel">
                <h3>By State</h3>
                <div className="browse-links">
                  {stateLinks.map(([label, href]) => <a key={label} href={href}>{label} <Chevron /></a>)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="portal-section" id="sources">
          <div className="container">
            <div className="section-title-bar green">
              <h2>Official Recruitment Sources</h2>
              <span>{connectedSources} CONNECTED</span>
            </div>

            <div className="source-grid">
              {sources.map((source) => (
                <a key={source.organization} href={source.url} target="_blank" rel="noopener noreferrer" className="source-item">
                  <ShieldCheck size={17} />
                  <span>{source.organization}<small>{source.connected ? "Connected" : "Unavailable"}</small></span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="disclaimer">
          <div className="container disclaimer-in">
            <ShieldCheck size={20} />
            <p><b>Important:</b> RojgaarMitra is an independent information portal. We are not a government department. Always read and verify the original official notification before applying. Application links lead to the official recruitment website.</p>
          </div>
        </section>
      </main>

      <footer className="classic-footer">
        <div className="container footer-grid">
          <div>
            <div className="classic-brand footer-brand">
              <span className="brand-mark">RM</span>
              <span><strong>ROJGAAR MITRA</strong><small>Sarkari Naukri &amp; Results</small></span>
            </div>
            <p>Government job notifications, results and exam updates from official sources.</p>
          </div>
          <div>
            <b>Quick Links</b>
            <a href="#jobs">Latest Jobs</a>
            <a href="#results">Results</a>
            <a href="#admit-card">Admit Card</a>
            <a href="#answer-key">Answer Key</a>
          </div>
          <div>
            <b>Browse</b>
            <a href="#sources">Official Sources</a>
            <a href="#calendar">Qualification</a>
            <a href="#calendar">State Wise</a>
          </div>
        </div>
      </footer>
    </>
  );
}

function Chevron() {
  return <span aria-hidden="true">›</span>;
}
