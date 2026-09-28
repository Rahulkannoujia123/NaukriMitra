type LiveSource = {
  id: string;
  organization: string;
  category: string;
  url: string;
  title: string;
  link: string;
  publishedAt: string | null;
  source: "OFFICIAL";
};

type SourceConfig = { organization: string; category: string; url: string; feedUrl?: string };

export const LIVE_SOURCES: SourceConfig[] = [
  { organization: "UPSC", category: "Central Government", url: "https://www.upsc.gov.in/", feedUrl: "https://www.upsc.gov.in/recruitment/recruitment-test/notices" },
  { organization: "Staff Selection Commission", category: "SSC", url: "https://ssc.gov.in/" },
  { organization: "Employment News", category: "Government Jobs", url: "https://employmentnews.gov.in/newemp/careers.aspx" },
  { organization: "IBPS", category: "Banking", url: "https://www.ibps.in/index.php/recruitment/", feedUrl: "https://www.ibps.in/" },
  { organization: "National Career Service", category: "Government Jobs", url: "https://ncs.gov.in/" },
  { organization: "Railway Recruitment Boards", category: "Railway", url: "https://www.rrbapply.gov.in/" },
  { organization: "Indian Railways", category: "Railway", url: "https://indianrailways.gov.in/" },
  { organization: "LIC", category: "Insurance", url: "https://licindia.in/careers" },
  { organization: "RBI", category: "Banking", url: "https://www.rbi.org.in/Scripts/BS_View.aspx?Id=160" },
  { organization: "SEBI", category: "Banking", url: "https://www.sebi.gov.in/sebiweb/about/AboutAction.do?doCareer=yes" },
  { organization: "NABARD", category: "Banking", url: "https://www.nabard.org/careers-notices1.aspx" },
  { organization: "SIDBI", category: "Banking", url: "https://www.sidbi.in/en/careers" },
  { organization: "SBI Careers", category: "Banking", url: "https://sbi.co.in/web/careers" },
  { organization: "India Post", category: "Postal", url: "https://indiapost.gov.in/" },
  { organization: "India Post GDS", category: "Postal", url: "https://indiapostgdsonline.gov.in/" },
  { organization: "DRDO", category: "Defence", url: "https://www.drdo.gov.in/careers" },
  { organization: "ISRO", category: "Space", url: "https://www.isro.gov.in/Careers.html" },
  { organization: "Indian Army", category: "Defence", url: "https://joinindianarmy.nic.in/" },
  { organization: "Indian Navy", category: "Defence", url: "https://www.joinindiannavy.gov.in/" },
  { organization: "Indian Air Force", category: "Defence", url: "https://afcat.cdac.in/AFCAT/" },
  { organization: "Coast Guard", category: "Defence", url: "https://joinindiancoastguard.cdac.in/" },
  { organization: "BSF", category: "Defence", url: "https://rectt.bsf.gov.in/" },
  { organization: "CRPF", category: "Defence", url: "https://rect.crpf.gov.in/" },
  { organization: "CISF", category: "Defence", url: "https://cisfrectt.cisf.gov.in/" },
  { organization: "ITBP", category: "Defence", url: "https://recruitment.itbpolice.nic.in/" },
  { organization: "Assam Rifles", category: "Defence", url: "https://www.assamrifles.gov.in/" },
  { organization: "LIC Housing Finance", category: "Finance", url: "https://www.lichousing.com/careers" },
  { organization: "Power Grid", category: "PSU", url: "https://www.powergrid.in/en/job-opportunities" },
  { organization: "NTPC", category: "PSU", url: "https://careers.ntpc.co.in/" },
  { organization: "ONGC", category: "PSU", url: "https://ongcindia.com/web/eng/careers" },
  { organization: "BHEL", category: "PSU", url: "https://careers.bhel.in/" },
  { organization: "SAIL", category: "PSU", url: "https://sailcareers.com/" },
  { organization: "Coal India", category: "PSU", url: "https://www.coalindia.in/career-cil/" },
  { organization: "HAL", category: "PSU", url: "https://hal-india.co.in/careers" },
  { organization: "BEL", category: "PSU", url: "https://bel-india.in/careers/" },
  { organization: "GAIL", category: "PSU", url: "https://www.gailonline.com/home.html" },
  { organization: "CSIR", category: "Research", url: "https://www.csir.res.in/careers" },
  { organization: "UGC", category: "Education", url: "https://www.ugc.gov.in/" },
  { organization: "NTA", category: "Education", url: "https://exams.nta.ac.in/" },
  { organization: "Maharashtra PSC", category: "State Government", url: "https://mpsc.gov.in/" },
  { organization: "UPPSC", category: "State Government", url: "https://uppsc.up.nic.in/" },
  { organization: "BPSC", category: "State Government", url: "https://bpsc.bih.nic.in/" },
  { organization: "MPPSC", category: "State Government", url: "https://mppsc.mp.gov.in/" },
  { organization: "RPSC", category: "State Government", url: "https://rpsc.rajasthan.gov.in/" },
  { organization: "Gujarat PSC", category: "State Government", url: "https://gpsc.gujarat.gov.in/" },
  { organization: "HPSC", category: "State Government", url: "https://hpsc.gov.in/" },
  { organization: "JKPSC", category: "State Government", url: "https://jkpsc.nic.in/" },
  { organization: "JPSC", category: "State Government", url: "https://www.jpsc.gov.in/" },
  { organization: "KPSC", category: "State Government", url: "https://kpsc.kar.nic.in/" },
  { organization: "Kerala PSC", category: "State Government", url: "https://www.keralapsc.gov.in/" },
  { organization: "TNPSC", category: "State Government", url: "https://www.tnpsc.gov.in/" },
  { organization: "WBPSC", category: "State Government", url: "https://psc.wb.gov.in/" },
  { organization: "Odisha PSC", category: "State Government", url: "https://www.opsc.gov.in/" },
  { organization: "APPSC", category: "State Government", url: "https://psc.ap.gov.in/" },
  { organization: "TSPSC", category: "State Government", url: "https://websitenew.tspsc.gov.in/" },
  { organization: "Goa PSC", category: "State Government", url: "https://gpsc.goa.gov.in/" },
  { organization: "HPPSC", category: "State Government", url: "https://hppsc.hp.gov.in/" },
  { organization: "UKPSC", category: "State Government", url: "https://psc.uk.gov.in/" },
  { organization: "Chhattisgarh PSC", category: "State Government", url: "https://psc.cg.gov.in/" },
  { organization: "MPSC Employment Maharashtra", category: "State Government", url: "https://rojgar.mahaswayam.gov.in/" },
];

const absoluteUrl = (base: string, href: string) => {
  try { return new URL(href, base).toString(); } catch { return null; }
};

const decodeHtml = (value: string) => value
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&#x27;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">");

const clean = (value: string) => decodeHtml(value
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ").trim();

const isUsefulNotice = (title: string, link: string) =>
  /(recruit|vacanc|career|notification|advertisement|recruitment|exam|admit|result|apply|selection|post|job|employment|notice|hiring|opening)/i.test(title + " " + link);

const extractLinks = (html: string, source: SourceConfig): LiveSource[] => {
  const results: LiveSource[] = [];
  const seen = new Set<string>();
  const baseUrl = source.feedUrl || source.url;

  const add = (href: string, rawTitle: string) => {
    const link = absoluteUrl(baseUrl, href);
    const title = clean(rawTitle);
    if (!link || title.length < 8 || !isUsefulNotice(title, link)) return;
    const key = link + "|" + title;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      id: Buffer.from(source.organization + "|" + title + "|" + link).toString("base64url").slice(0, 40),
      organization: source.organization,
      category: source.category,
      url: source.url,
      title,
      link,
      publishedAt: null,
      source: "OFFICIAL",
    });
  };

  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) && results.length < 50) {
    add(match[1], match[2]);
  }

  return results;
};

export async function fetchLiveSourceNotices() {
  const settled = await Promise.allSettled(LIVE_SOURCES.map(async (source) => {
    const feedUrl = source.feedUrl || source.url;
    const response = await fetch(feedUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; RojgaarMitra/1.0; +https://rojgaarmitra.vercel.app)",
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(source.organization + ": HTTP " + response.status);
    return { source, notices: extractLinks(await response.text(), source) };
  }));

  const notices = settled.flatMap((item) =>
    item.status === "fulfilled" ? item.value.notices : []
  );
  const failedSources = settled.flatMap((item) =>
    item.status === "rejected" ? [String(item.reason)] : []
  );

  return {
    data: notices,
    sources: LIVE_SOURCES.map((source) => ({
      organization: source.organization,
      category: source.category,
      url: source.url,
      connected: !failedSources.some((error) => error.includes(source.organization)),
    })),
    fetchedAt: new Date().toISOString(),
    failedCount: failedSources.length,
    note: notices.length > 0
      ? "Live notices are read from official source pages. Verify the original notification before applying."
      : "No matching notice links were extracted. Open the official source directory below and verify the latest notification.",
  };
}
