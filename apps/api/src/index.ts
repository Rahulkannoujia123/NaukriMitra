import "dotenv/config";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ExamEventType, PrismaClient, ReminderOffset, Role, SourceKind, UpdateType, VerificationStatus, type Prisma } from "@prisma/client";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { assessEligibility, type Candidate } from "./eligibility";

const app = express();
const prisma = new PrismaClient();
const production = process.env.NODE_ENV === "production";
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;
if (production && (!accessSecret || accessSecret.length < 32 || !refreshSecret || refreshSecret.length < 32)) {
  throw new Error("Strong JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values are required in production.");
}

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: webOrigin, credentials: true }));
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser() as unknown as RequestHandler);
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }) as unknown as RequestHandler);
app.use("/api/v1/auth", rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }) as unknown as RequestHandler);

type Claims = { sub: string; role: Role };
type AuthRequest = Request & { claims?: Claims };
const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
const refreshCookieOptions = { httpOnly: true, secure: production, sameSite: "strict" as const, path: "/api/v1/auth", maxAge: 30 * 24 * 60 * 60 * 1000 };
const accessJwt = (user: { id: string; role: Role }) => jwt.sign({ sub: user.id, role: user.role }, accessSecret ?? "local-only-access-secret", { expiresIn: "10m", issuer: "naukrisetu-api", audience: "naukrisetu-web" });
const refreshJwt = (user: { id: string; role: Role }) => jwt.sign({ sub: user.id, role: user.role, nonce: randomBytes(24).toString("hex") }, refreshSecret ?? "local-only-refresh-secret", { expiresIn: "30d", issuer: "naukrisetu-api", audience: "naukrisetu-refresh" });
const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "AUTH_REQUIRED" });
  try { req.claims = jwt.verify(header.slice(7), accessSecret ?? "local-only-access-secret", { issuer: "naukrisetu-api", audience: "naukrisetu-web" }) as Claims; next(); }
  catch { return res.status(401).json({ error: "INVALID_SESSION" }); }
};
const requireRole = (...roles: Role[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.claims || !roles.includes(req.claims.role)) return res.status(403).json({ error: "FORBIDDEN" });
  next();
};
const verifyMutationOrigin = (req: Request, res: Response, next: NextFunction) => {
  if (req.header("origin") !== webOrigin) return res.status(403).json({ error: "INVALID_ORIGIN" });
  next();
};
const httpUrl = z.string().url().refine(value => { const protocol = new URL(value).protocol; return protocol === "http:" || protocol === "https:"; }, "Use an HTTP or HTTPS URL.");
const asyncRoute = (fn: (req: AuthRequest, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req as AuthRequest, res)).catch(next);
};

const accountInput = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(12).max(128) });
const jobInput = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120), organization: z.string().trim().min(2).max(180), postName: z.string().trim().min(2).max(180),
  vacancy: z.number().int().nonnegative().nullable().optional(), salaryText: z.string().max(100).nullable().optional(), salaryMin: z.number().int().nonnegative().nullable().optional(), salaryMax: z.number().int().nonnegative().nullable().optional(),
  ageMin: z.number().int().nonnegative().nullable().optional(), ageMax: z.number().int().positive().nullable().optional(), ageCutoffDate: z.string().datetime().nullable().optional(), experienceMinMonths: z.number().int().nonnegative().nullable().optional(),
  applicationStart: z.string().datetime().nullable().optional(), applicationEnd: z.string().datetime().nullable().optional(), examDate: z.string().datetime().nullable().optional(), location: z.array(z.string().max(100)).max(100).optional(), states: z.array(z.string().max(100)).max(100).optional(), departments: z.array(z.string().max(100)).max(100).optional(), jobType: z.string().max(80).nullable().optional(), exam: z.string().max(180).nullable().optional(),
  sourceUrl: httpUrl.nullable().optional(), sourceOrganization: z.string().max(180).nullable().optional(), notificationUrl: httpUrl.nullable().optional(), applicationUrl: httpUrl.nullable().optional(), notificationDate: z.string().datetime().nullable().optional(),
  qualifications: z.array(z.object({ qualification: z.string().min(1).max(100), degree: z.string().max(160).nullable().optional(), branch: z.string().max(160).nullable().optional(), minimumPassingYear: z.number().int().nullable().optional(), maximumPassingYear: z.number().int().nullable().optional(), notes: z.string().max(1000).nullable().optional() })).max(30).optional(),
  documents: z.array(z.object({ documentName: z.string().trim().min(1).max(160), required: z.boolean().nullable().optional(), condition: z.string().max(1000).nullable().optional(), sourcePage: z.string().max(100).nullable().optional() })).max(50).optional(),
});

async function persistRefreshToken(user: { id: string; role: Role }, res: Response) {
  const token = refreshJwt(user);
  const decoded = jwt.decode(token) as jwt.JwtPayload;
  await prisma.refreshToken.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(decoded.exp! * 1000) } });
  res.cookie("ns_refresh", token, refreshCookieOptions);
}

app.get("/api/v1/health", (_req, res) => res.json({ status: "ok" }));
app.post("/api/v1/auth/register", verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = accountInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const user = await prisma.user.create({ data: { email: parsed.data.email, passwordHash: await argon2.hash(parsed.data.password, { type: argon2.argon2id }) }, select: { id: true, email: true, role: true } });
  await persistRefreshToken(user, res);
  return res.status(201).json({ user, accessToken: accessJwt(user) });
}));
app.post("/api/v1/auth/login", verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = accountInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT" });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await argon2.verify(user.passwordHash, parsed.data.password))) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  await persistRefreshToken(user, res);
  return res.json({ user: { id: user.id, email: user.email, role: user.role }, accessToken: accessJwt(user) });
}));
app.post("/api/v1/auth/refresh", verifyMutationOrigin, asyncRoute(async (req, res) => {
  const token = req.cookies.ns_refresh as string | undefined;
  if (!token) return res.status(401).json({ error: "INVALID_SESSION" });
  let claims: Claims;
  try { claims = jwt.verify(token, refreshSecret ?? "local-only-refresh-secret", { issuer: "naukrisetu-api", audience: "naukrisetu-refresh" }) as Claims; }
  catch { res.clearCookie("ns_refresh", refreshCookieOptions); return res.status(401).json({ error: "INVALID_SESSION" }); }
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || stored.userId !== claims.sub) { res.clearCookie("ns_refresh", refreshCookieOptions); return res.status(401).json({ error: "INVALID_SESSION" }); }
  const user = await prisma.user.findUnique({ where: { id: stored.userId }, select: { id: true, email: true, role: true } });
  if (!user) return res.status(401).json({ error: "INVALID_SESSION" });
  const nextToken = refreshJwt(user);
  const decoded = jwt.decode(nextToken) as jwt.JwtPayload;
  await prisma.$transaction([prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }), prisma.refreshToken.create({ data: { tokenHash: hashToken(nextToken), userId: user.id, expiresAt: new Date(decoded.exp! * 1000) } })]);
  res.cookie("ns_refresh", nextToken, refreshCookieOptions);
  return res.json({ user, accessToken: accessJwt(user) });
}));
app.post("/api/v1/auth/logout", verifyMutationOrigin, asyncRoute(async (req, res) => {
  const token = req.cookies.ns_refresh as string | undefined;
  if (token) await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  res.clearCookie("ns_refresh", refreshCookieOptions);
  return res.status(204).end();
}));
app.get("/api/v1/me", auth, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.claims!.sub }, select: { id: true, email: true, role: true, profile: true } });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
  return res.json({ user });
}));
const profileInput = z.object({ dateOfBirth: z.string().datetime().nullable().optional(), gender: z.string().max(40).nullable().optional(), state: z.string().max(100).nullable().optional(), district: z.string().max(100).nullable().optional(), qualification: z.string().max(100).nullable().optional(), degree: z.string().max(160).nullable().optional(), branch: z.string().max(160).nullable().optional(), passingYear: z.number().int().min(1940).max(2100).nullable().optional(), category: z.string().max(60).nullable().optional(), experienceMonths: z.number().int().min(0).max(1200).nullable().optional(), preferredDepartments: z.array(z.string().max(100)).max(50).optional(), preferredLocations: z.array(z.string().max(100)).max(50).optional(), salaryMin: z.number().int().nonnegative().nullable().optional() });
app.patch("/api/v1/me/profile", auth, verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = profileInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const data = { ...parsed.data, dateOfBirth: parsed.data.dateOfBirth === undefined ? undefined : parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null };
  const profile = await prisma.candidateProfile.upsert({ where: { userId: req.claims!.sub }, create: { userId: req.claims!.sub, ...data }, update: data });
  return res.json({ profile });
}));

app.get("/api/v1/jobs", asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
  const query = String(req.query.q ?? "").trim().slice(0, 100);
  const qualification = String(req.query.qualification ?? "").trim().slice(0, 100);
  const state = String(req.query.state ?? "").trim().slice(0, 100);
  const district = String(req.query.district ?? "").trim().slice(0, 100);
  const department = String(req.query.department ?? "").trim().slice(0, 100);
  const jobType = String(req.query.jobType ?? "").trim().slice(0, 80);
  const exam = String(req.query.exam ?? "").trim().slice(0, 180);
  const age = Number(req.query.age);
  const salaryMin = Number(req.query.salaryMin);
  const experienceMonths = Number(req.query.experienceMonths);
  const vacancyMin = Number(req.query.vacancyMin);
  const closeWithinDays = Number(req.query.closeWithinDays);
  const filters: Prisma.JobWhereInput[] = [];
  if (Number.isFinite(salaryMin) && salaryMin > 0) filters.push({ OR: [{ salaryMax: { gte: salaryMin } }, { salaryMax: null, salaryMin: { gte: salaryMin } }] });
  if (Number.isFinite(experienceMonths) && experienceMonths >= 0) filters.push({ OR: [{ experienceMinMonths: null }, { experienceMinMonths: { lte: experienceMonths } }] });
  if (Number.isInteger(age) && age >= 14 && age <= 100) filters.push({ AND: [{ OR: [{ ageMin: null }, { ageMin: { lte: age } }] }, { OR: [{ ageMax: null }, { ageMax: { gte: age } }] }] });
  if (Number.isFinite(closeWithinDays) && closeWithinDays > 0) filters.push({ applicationEnd: { gte: new Date(), lte: new Date(Date.now() + Math.min(closeWithinDays, 365) * 86_400_000) } });
  const where: Prisma.JobWhereInput = {
    status: "PUBLISHED",
    ...(query ? { OR: [{ organization: { contains: query, mode: "insensitive" } }, { postName: { contains: query, mode: "insensitive" } }, { exam: { contains: query, mode: "insensitive" } }] } : {}),
    ...(qualification ? { qualifications: { some: { qualification: { contains: qualification, mode: "insensitive" } } } } : {}),
    ...(state ? { states: { has: state } } : {}),
    ...(district ? { location: { has: district } } : {}),
    ...(department ? { departments: { has: department } } : {}),
    ...(jobType ? { jobType: { equals: jobType, mode: "insensitive" } } : {}),
    ...(exam ? { exam: { contains: exam, mode: "insensitive" } } : {}),
    ...(Number.isFinite(vacancyMin) && vacancyMin > 0 ? { vacancy: { gte: vacancyMin } } : {}),
    ...(filters.length ? { AND: filters } : {}),
  };
  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ applicationEnd: "asc" }, { publishedAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize,
    select: { id: true, slug: true, organization: true, postName: true, vacancy: true, salaryText: true, salaryMin: true, salaryMax: true, applicationStart: true, applicationEnd: true, examDate: true, location: true, sourceUrl: true, sourceOrganization: true, notificationUrl: true, applicationUrl: true, lastVerifiedAt: true, verificationStatus: true, sourceKind: true, qualifications: true },
  });
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  return res.json({ data: jobs, page, pageSize });
}));
app.get("/api/v1/jobs/:slug", asyncRoute(async (req, res) => {
  const job = await prisma.job.findFirst({ where: { slug: req.params.slug, status: "PUBLISHED" }, include: { qualifications: true, documents: true, updates: { orderBy: { publishedAt: "desc" } } } });
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  return res.json({ data: job });
}));
app.get("/api/v1/jobs/:slug/updates", asyncRoute(async (req, res) => {
  const typeMap: Record<string, UpdateType[]> = {
    results: [UpdateType.RESULT, UpdateType.CUTOFF, UpdateType.MERIT_LIST],
    admitCard: [UpdateType.ADMIT_CARD],
    answerKey: [UpdateType.ANSWER_KEY],
  };
  const key = typeof req.query.type === "string" ? req.query.type : "";
  const types = typeMap[key];
  if (!types) return res.status(400).json({ error: "INVALID_UPDATE_TYPE" });
  const job = await prisma.job.findFirst({ where: { slug: req.params.slug, status: "PUBLISHED" }, select: { id: true, slug: true, postName: true, organization: true, sourceUrl: true, sourceOrganization: true, verificationStatus: true, sourceKind: true, lastVerifiedAt: true } });
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  const updates = await prisma.jobUpdate.findMany({ where: { jobId: job.id, type: { in: types }, publishedAt: { not: null } }, orderBy: { publishedAt: "desc" } });
  return res.json({ data: { job, updates } });
}));
app.post("/api/v1/assistant", asyncRoute(async (req, res) => {
  const parsed = z.object({ message: z.string().trim().min(2).max(800) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const message = parsed.data.message.toLocaleLowerCase("en-IN");
  const closingIntent = /\b(closing|deadline|last date|close this week)\b/.test(message);
  const stopWords = new Set(["what", "which", "jobs", "job", "should", "could", "would", "for", "from", "with", "this", "that", "have", "check", "show", "me", "are", "the", "and", "you", "your", "week", "closing", "deadline", "last", "date"]);
  const terms = [...new Set(message.match(/[a-z0-9]{2,}/g) ?? [])].filter(term => !stopWords.has(term));
  const now = new Date();
  const candidates = await prisma.job.findMany({
    where: {
      status: "PUBLISHED",
      ...(closingIntent ? { applicationEnd: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) } } : {}),
    },
    include: { qualifications: { select: { qualification: true, degree: true, branch: true } } },
    orderBy: [{ applicationEnd: "asc" }, { publishedAt: "desc" }],
    take: 300,
  });
  const matches = candidates.map(job => {
    const haystack = [job.organization, job.postName, job.exam ?? "", ...job.departments, ...job.states, ...job.location, ...job.qualifications.flatMap(item => [item.qualification, item.degree ?? "", item.branch ?? ""])].join(" ").toLocaleLowerCase("en-IN");
    const matchedTerms = terms.filter(term => haystack.includes(term));
    return { job, matchedTerms, score: matchedTerms.length };
  }).filter(item => closingIntent ? true : item.score > 0).sort((left, right) => right.score - left.score).slice(0, 12);
  const data = matches.map(({ job, matchedTerms }) => ({ id: job.id, slug: job.slug, organization: job.organization, postName: job.postName, applicationEnd: job.applicationEnd, applicationUrl: job.applicationUrl, notificationUrl: job.notificationUrl, sourceUrl: job.sourceUrl, sourceOrganization: job.sourceOrganization, lastVerifiedAt: job.lastVerifiedAt, verificationStatus: job.verificationStatus, sourceKind: job.sourceKind, matchedTerms }));
  let answer = matches.length ? `${matches.length} database listing${matches.length === 1 ? "" : "s"} matched. Confirm dates and eligibility in each original notification.` : "No published database listings matched that question. Try a qualification, department, state, or exam name.";
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey && data.length) {
    try {
      const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openRouterKey}`, "HTTP-Referer": process.env.SITE_URL ?? webOrigin, "X-Title": "NaukriSetu" },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 350,
          messages: [
            { role: "system", content: "You are NaukriSetu's job assistant. Use ONLY the supplied database records. Never invent vacancies, dates, eligibility, salary, organizations, or links. If the records do not establish something, say it is not available and tell the user to check the official notification. Answer concisely in the user's language when possible." },
            { role: "user", content: JSON.stringify({ question: parsed.data.message, records: data.map(item => ({ organization: item.organization, postName: item.postName, applicationEnd: item.applicationEnd, matchedTerms: item.matchedTerms, verificationStatus: item.verificationStatus, sourceOrganization: item.sourceOrganization })) }) }
          ]
        })
      });
      if (aiResponse.ok) {
        const aiJson = await aiResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
        const generated = aiJson.choices?.[0]?.message?.content?.trim();
        if (generated) answer = generated;
      }
    } catch (error) {
      console.warn("OpenRouter assistant fallback:", error);
    }
  }
  return res.json({
    answer,
    eligibilityNotice: "AI answers are grounded in published database records, not a final eligibility decision. Review the official notification before applying.",
    data,
  });
}));
const eligibilityInput = z.object({ dateOfBirth: z.string().datetime().nullable().optional(), qualification: z.string().max(100).nullable().optional(), degree: z.string().max(160).nullable().optional(), branch: z.string().max(160).nullable().optional(), passingYear: z.number().int().nullable().optional(), category: z.string().max(60).nullable().optional(), state: z.string().max(100).nullable().optional(), experienceMonths: z.number().int().min(0).nullable().optional() });
app.post("/api/v1/jobs/:id/eligibility", asyncRoute(async (req, res) => {
  const parsed = eligibilityInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const job = await prisma.job.findFirst({ where: { id: req.params.id, status: "PUBLISHED" }, include: { qualifications: true, documents: true } });
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  const candidate: Candidate = { ...parsed.data, dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null };
  return res.json({ result: assessEligibility(candidate, job) });
}));
app.get("/api/v1/me/matches", auth, asyncRoute(async (req, res) => {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: req.claims!.sub } });
  if (!profile) return res.json({ eligible: [], checkManually: [], profileRequired: true });
  const jobs = await prisma.job.findMany({ where: { status: "PUBLISHED" }, include: { qualifications: true, documents: true }, orderBy: [{ applicationEnd: "asc" }, { publishedAt: "desc" }], take: 100 });
  const eligible = [];
  const checkManually = [];
  for (const job of jobs) {
    const result = assessEligibility(profile, job);
    if (result.status === "ELIGIBLE") eligible.push({ job, reasons: result.reasons });
    else if (result.status === "CHECK_MANUALLY") checkManually.push({ job, reasons: result.reasons });
  }
  return res.json({ eligible, checkManually, profileRequired: false });
}));

app.get("/api/v1/me/saved-jobs", auth, asyncRoute(async (req, res) => {
  const savedJobs = await prisma.savedJob.findMany({
    where: { userId: req.claims!.sub },
    include: { job: { select: { id: true, slug: true, postName: true, organization: true, applicationEnd: true, verificationStatus: true } } },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ data: savedJobs });
}));
app.post("/api/v1/me/saved-jobs", auth, verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = z.object({ jobId: z.string().min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT" });
  const job = await prisma.job.findFirst({ where: { id: parsed.data.jobId, status: "PUBLISHED" }, select: { id: true } });
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  const saved = await prisma.savedJob.upsert({
    where: { userId_jobId: { userId: req.claims!.sub, jobId: job.id } },
    create: { userId: req.claims!.sub, jobId: job.id },
    update: {},
  });
  return res.status(201).json({ data: saved });
}));
app.delete("/api/v1/me/saved-jobs/:jobId", auth, verifyMutationOrigin, asyncRoute(async (req, res) => {
  await prisma.savedJob.deleteMany({ where: { userId: req.claims!.sub, jobId: req.params.jobId } });
  return res.status(204).end();
}));
app.get("/api/v1/me/applications", auth, asyncRoute(async (req, res) => {
  const applications = await prisma.applicationTracker.findMany({
    where: { userId: req.claims!.sub },
    include: { job: { select: { id: true, slug: true, postName: true, organization: true, applicationEnd: true, verificationStatus: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return res.json({ data: applications });
}));
app.put("/api/v1/me/applications/:jobId", auth, verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = z.object({ state: z.enum(["INTERESTED", "SAVED", "APPLIED", "ADMIT_CARD_DOWNLOADED", "EXAM_COMPLETED", "RESULT_AWAITED", "SELECTED", "NOT_SELECTED"]), notes: z.string().max(2000).nullable().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const job = await prisma.job.findFirst({ where: { id: req.params.jobId, status: "PUBLISHED" }, select: { id: true } });
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  const application = await prisma.applicationTracker.upsert({
    where: { userId_jobId: { userId: req.claims!.sub, jobId: job.id } },
    create: { userId: req.claims!.sub, jobId: job.id, ...parsed.data },
    update: parsed.data,
  });
  return res.json({ data: application });
}));
app.get("/api/v1/me/reminders", auth, asyncRoute(async (req, res) => {
  const reminders = await prisma.reminder.findMany({
    where: { userId: req.claims!.sub },
    include: { job: { select: { id: true, slug: true, postName: true, organization: true, applicationEnd: true } } },
    orderBy: [{ job: { applicationEnd: "asc" } }, { offset: "asc" }],
  });
  return res.json({ data: reminders });
}));
app.put("/api/v1/me/reminders/:jobId", auth, verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = z.object({ offsets: z.array(z.nativeEnum(ReminderOffset)).max(4) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const job = await prisma.job.findFirst({ where: { id: req.params.jobId, status: "PUBLISHED" }, select: { id: true, applicationEnd: true } });
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (!job.applicationEnd) return res.status(422).json({ error: "DEADLINE_NOT_RECORDED", message: "A reminder needs a recorded application deadline." });
  await prisma.$transaction(async tx => {
    await tx.reminder.deleteMany({ where: { userId: req.claims!.sub, jobId: job.id } });
    if (parsed.data.offsets.length) await tx.reminder.createMany({ data: parsed.data.offsets.map(offset => ({ userId: req.claims!.sub, jobId: job.id, offset })) });
  });
  const reminders = await prisma.reminder.findMany({ where: { userId: req.claims!.sub, jobId: job.id }, orderBy: { offset: "asc" } });
  return res.json({ data: reminders });
}));
app.delete("/api/v1/me/reminders/:jobId", auth, verifyMutationOrigin, asyncRoute(async (req, res) => {
  await prisma.reminder.deleteMany({ where: { userId: req.claims!.sub, jobId: req.params.jobId } });
  return res.status(204).end();
}));

app.get("/api/v1/me/notifications", auth, asyncRoute(async (req, res) => {
  const notifications = await prisma.notification.findMany({ where: { userId: req.claims!.sub }, orderBy: { createdAt: "desc" }, take: 50 });
  return res.json({ data: notifications });
}));
app.post("/api/v1/me/notifications/:id/read", auth, verifyMutationOrigin, asyncRoute(async (req, res) => {
  const notification = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.claims!.sub }, data: { readAt: new Date() } });
  if (!notification.count) return res.status(404).json({ error: "NOTIFICATION_NOT_FOUND" });
  return res.status(204).end();
}));

const reminderCronSecret = process.env.CRON_SECRET;
app.post("/api/v1/internal/reminders/run", asyncRoute(async (req, res) => {
  if (!reminderCronSecret || req.header("x-cron-secret") !== reminderCronSecret) return res.status(401).json({ error: "UNAUTHORIZED" });
  const now = new Date();
  const reminders = await prisma.reminder.findMany({
    where: { enabled: true, sentAt: null, job: { status: "PUBLISHED", applicationEnd: { not: null, gt: now } } },
    include: { job: { select: { id: true, postName: true, organization: true, applicationEnd: true } } },
    take: 500,
  });
  const due = reminders.filter(reminder => {
    const deadline = reminder.job.applicationEnd!;
    const offsetMs = reminder.offset === ReminderOffset.DAYS_7 ? 7 * 86_400_000 : reminder.offset === ReminderOffset.DAYS_3 ? 3 * 86_400_000 : reminder.offset === ReminderOffset.DAYS_1 ? 86_400_000 : 0;
    const target = new Date(deadline.getTime() - offsetMs);
    return now >= target && now < new Date(target.getTime() + 86_400_000);
  });
  for (const reminder of due) {
    await prisma.$transaction([
      prisma.notification.create({ data: { userId: reminder.userId, title: "Job deadline reminder", body: `${reminder.job.postName} at ${reminder.job.organization} closes on ${reminder.job.applicationEnd!.toISOString()}.` } }),
      prisma.reminder.update({ where: { id: reminder.id }, data: { sentAt: now } }),
    ]);
  }
  return res.json({ processed: due.length });
}));

async function listJobUpdates(res: Response, types: UpdateType[]) {
  const updates = await prisma.jobUpdate.findMany({
    where: { type: { in: types }, publishedAt: { not: null }, job: { status: "PUBLISHED" } },
    include: { job: { select: { slug: true, postName: true, organization: true, sourceUrl: true, sourceOrganization: true, verificationStatus: true, lastVerifiedAt: true } } },
    orderBy: { publishedAt: "desc" },
    take: 100,
  });
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return res.json({ data: updates });
}
app.get("/api/v1/results", asyncRoute(async (_req, res) => listJobUpdates(res, [UpdateType.RESULT, UpdateType.CUTOFF, UpdateType.MERIT_LIST])));
app.get("/api/v1/admit-cards", asyncRoute(async (_req, res) => listJobUpdates(res, [UpdateType.ADMIT_CARD])));
app.get("/api/v1/answer-keys", asyncRoute(async (_req, res) => listJobUpdates(res, [UpdateType.ANSWER_KEY])));
app.get("/api/v1/exams", asyncRoute(async (_req, res) => {
  const exams = await prisma.exam.findMany({
    include: { events: { where: { date: { not: null } }, orderBy: { date: "asc" }, take: 6 } },
    orderBy: { name: "asc" },
  });
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return res.json({ data: exams });
}));
app.get("/api/v1/exams/:slug", asyncRoute(async (req, res) => {
  const exam = await prisma.exam.findUnique({ where: { slug: req.params.slug }, include: { events: { orderBy: { date: "asc" } } } });
  if (!exam) return res.status(404).json({ error: "EXAM_NOT_FOUND" });
  return res.json({ data: exam });
}));
app.get("/api/v1/me/followed-exams", auth, asyncRoute(async (req, res) => {
  const followed = await prisma.userExam.findMany({ where: { userId: req.claims!.sub }, include: { exam: { include: { events: { where: { date: { not: null } }, orderBy: { date: "asc" } } } } }, orderBy: { createdAt: "desc" } });
  return res.json({ data: followed });
}));
app.post("/api/v1/me/followed-exams", auth, verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = z.object({ examId: z.string().min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT" });
  const exam = await prisma.exam.findUnique({ where: { id: parsed.data.examId }, select: { id: true } });
  if (!exam) return res.status(404).json({ error: "EXAM_NOT_FOUND" });
  const followed = await prisma.userExam.upsert({ where: { userId_examId: { userId: req.claims!.sub, examId: exam.id } }, create: { userId: req.claims!.sub, examId: exam.id }, update: {} });
  return res.status(201).json({ data: followed });
}));
app.delete("/api/v1/me/followed-exams/:examId", auth, verifyMutationOrigin, asyncRoute(async (req, res) => {
  await prisma.userExam.deleteMany({ where: { userId: req.claims!.sub, examId: req.params.examId } });
  return res.status(204).end();
}));
app.get("/api/v1/calendar", asyncRoute(async (req, res) => {
  const fromValue = typeof req.query.from === "string" ? req.query.from : undefined;
  const toValue = typeof req.query.to === "string" ? req.query.to : undefined;
  const from = fromValue ? new Date(fromValue) : new Date();
  const to = toValue ? new Date(toValue) : new Date(Date.now() + 365 * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return res.status(400).json({ error: "INVALID_DATE_RANGE" });
  const events = await prisma.examEvent.findMany({
    where: { date: { gte: from, lte: to } },
    include: { exam: { select: { slug: true, name: true, organization: true, officialUrl: true, sourceKind: true } } },
    orderBy: { date: "asc" },
    take: 500,
  });
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return res.json({ data: events });
}));

const editors = [Role.SUPER_ADMIN, Role.EDITOR];
const updateInput = z.object({
  type: z.nativeEnum(UpdateType), title: z.string().trim().min(2).max(180), details: z.string().max(5000).nullable().optional(),
  officialUrl: httpUrl.nullable().optional(), sourceOrganization: z.string().max(180).nullable().optional(), sourceKind: z.nativeEnum(SourceKind),
});
app.post("/api/v1/admin/jobs/:id/updates", auth, requireRole(...editors), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = updateInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const job = await prisma.job.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  const update = await prisma.$transaction(async tx => {
    const created = await tx.jobUpdate.create({ data: { jobId: job.id, ...parsed.data, publishedAt: null } });
    await tx.auditLog.create({ data: { actorId: req.claims!.sub, jobId: job.id, action: "JOB_UPDATE_DRAFTED", entityType: "JobUpdate", entityId: created.id } });
    return created;
  });
  return res.status(201).json({ data: update });
}));
app.post("/api/v1/admin/updates/:id/publish", auth, requireRole(...editors), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const update = await prisma.jobUpdate.findUnique({ where: { id: req.params.id }, include: { job: true } });
  if (!update) return res.status(404).json({ error: "UPDATE_NOT_FOUND" });
  if (update.sourceKind === SourceKind.OFFICIAL && (!update.officialUrl || !update.sourceOrganization || update.job.verificationStatus !== "VERIFIED" || !update.job.lastVerifiedAt)) {
    return res.status(422).json({ error: "OFFICIAL_SOURCE_REQUIRED", message: "Verify the recruitment source and add the official update link and source organization before publishing." });
  }
  const published = await prisma.$transaction(async tx => {
    const result = await tx.jobUpdate.update({ where: { id: update.id }, data: { publishedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: req.claims!.sub, jobId: update.jobId, action: "JOB_UPDATE_PUBLISHED", entityType: "JobUpdate", entityId: update.id } });
    return result;
  });
  return res.json({ data: published });
}));
const examInput = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120), name: z.string().trim().min(2).max(180), organization: z.string().trim().min(2).max(180), overview: z.string().max(5000).nullable().optional(), officialUrl: httpUrl.nullable().optional(), sourceKind: z.nativeEnum(SourceKind) });
app.post("/api/v1/admin/exams", auth, requireRole(...editors), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = examInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  if (parsed.data.sourceKind === SourceKind.OFFICIAL && !parsed.data.officialUrl) return res.status(422).json({ error: "OFFICIAL_SOURCE_REQUIRED" });
  const exam = await prisma.exam.create({ data: parsed.data });
  await prisma.auditLog.create({ data: { actorId: req.claims!.sub, action: "EXAM_CREATED", entityType: "Exam", entityId: exam.id } });
  return res.status(201).json({ data: exam });
}));
const eventInput = z.object({ type: z.nativeEnum(ExamEventType), date: z.string().datetime().nullable().optional(), endDate: z.string().datetime().nullable().optional(), title: z.string().max(180).nullable().optional(), officialUrl: httpUrl.nullable().optional(), sourceKind: z.nativeEnum(SourceKind) });
app.post("/api/v1/admin/exams/:id/events", auth, requireRole(...editors), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = eventInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, select: { id: true, officialUrl: true } });
  if (!exam) return res.status(404).json({ error: "EXAM_NOT_FOUND" });
  if (parsed.data.sourceKind === SourceKind.OFFICIAL && !parsed.data.officialUrl && !exam.officialUrl) return res.status(422).json({ error: "OFFICIAL_SOURCE_REQUIRED" });
  const event = await prisma.$transaction(async tx => {
    const created = await tx.examEvent.create({ data: { examId: exam.id, ...parsed.data, date: parsed.data.date ? new Date(parsed.data.date) : null, endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null } });
    await tx.auditLog.create({ data: { actorId: req.claims!.sub, action: "EXAM_EVENT_CREATED", entityType: "ExamEvent", entityId: created.id } });
    return created;
  });
  return res.status(201).json({ data: event });
}));
app.get("/api/v1/admin/analytics", auth, requireRole(Role.SUPER_ADMIN, Role.EDITOR, Role.MODERATOR), asyncRoute(async (_req, res) => {
  const [jobs, published, pendingReview, updates, exams, users] = await Promise.all([
    prisma.job.count(), prisma.job.count({ where: { status: "PUBLISHED" } }), prisma.job.count({ where: { verificationStatus: { in: ["UNVERIFIED", "REVIEW_REQUIRED"] } } }),
    prisma.jobUpdate.count(), prisma.exam.count(), prisma.user.count(),
  ]);
  return res.json({ data: { jobs, publishedJobs: published, jobsAwaitingSourceReview: pendingReview, updates, exams, users } });
}));
app.get("/api/v1/admin/audit-logs", auth, requireRole(Role.SUPER_ADMIN), asyncRoute(async (req, res) => {
  const take = Math.min(100, Math.max(1, Number(req.query.take) || 50));
  const logs = await prisma.auditLog.findMany({ include: { actor: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take });
  return res.json({ data: logs });
}));
app.get("/api/v1/admin/source-snapshots", auth, requireRole(Role.SUPER_ADMIN, Role.EDITOR, Role.MODERATOR), asyncRoute(async (req, res) => {
  const statusValue = typeof req.query.status === "string" ? req.query.status : "REVIEW_REQUIRED";
  const status = z.nativeEnum(VerificationStatus).safeParse(statusValue);
  if (!status.success) return res.status(400).json({ error: "INVALID_STATUS" });
  const snapshots = await prisma.sourceSnapshot.findMany({
    where: { verificationStatus: status.data },
    orderBy: [{ observedAt: "desc" }, { sourceOrganization: "asc" }],
    take: 200,
  });
  return res.json({ data: snapshots });
}));
app.patch("/api/v1/admin/source-snapshots/:id/review", auth, requireRole(Role.SUPER_ADMIN, Role.EDITOR, Role.MODERATOR), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = z.object({ status: z.enum([VerificationStatus.VERIFIED, VerificationStatus.REVIEW_REQUIRED]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const before = await prisma.sourceSnapshot.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "SNAPSHOT_NOT_FOUND" });
  const snapshot = await prisma.$transaction(async tx => {
    const updated = await tx.sourceSnapshot.update({ where: { id: before.id }, data: { verificationStatus: parsed.data.status } });
    await tx.auditLog.create({ data: { actorId: req.claims!.sub, action: "SOURCE_SNAPSHOT_REVIEWED", entityType: "SourceSnapshot", entityId: before.id, changes: { from: before.verificationStatus, to: parsed.data.status } } });
    return updated;
  });
  return res.json({ data: snapshot });
}));
app.get("/api/v1/admin/users", auth, requireRole(Role.SUPER_ADMIN), asyncRoute(async (req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return res.json({ data: users });
}));
app.patch("/api/v1/admin/users/:id/role", auth, requireRole(Role.SUPER_ADMIN), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = z.object({ role: z.nativeEnum(Role) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  if (req.params.id === req.claims!.sub && parsed.data.role !== Role.SUPER_ADMIN) return res.status(409).json({ error: "CANNOT_DEMOTE_SELF" });
  const before = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
  if (!before) return res.status(404).json({ error: "USER_NOT_FOUND" });
  if (before.role === Role.SUPER_ADMIN && parsed.data.role !== Role.SUPER_ADMIN && await prisma.user.count({ where: { role: Role.SUPER_ADMIN } }) <= 1) return res.status(409).json({ error: "LAST_SUPER_ADMIN" });
  const user = await prisma.$transaction(async tx => {
    const updated = await tx.user.update({ where: { id: before.id }, data: { role: parsed.data.role }, select: { id: true, email: true, role: true } });
    await tx.auditLog.create({ data: { actorId: req.claims!.sub, action: "USER_ROLE_CHANGED", entityType: "User", entityId: before.id, changes: { from: before.role, to: parsed.data.role } } });
    return updated;
  });
  return res.json({ data: user });
}));
app.get("/api/v1/admin/jobs", auth, requireRole(...editors), asyncRoute(async (req, res) => {
  const status = typeof req.query.status === "string" && ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(req.query.status) ? req.query.status as "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED" : undefined;
  const jobs = await prisma.job.findMany({
    where: status ? { status } : {},
    select: { id: true, slug: true, postName: true, organization: true, status: true, applicationEnd: true, verificationStatus: true, lastVerifiedAt: true, sourceOrganization: true },
    orderBy: { updatedAt: "desc" }, take: 100,
  });
  return res.json({ data: jobs });
}));
app.post("/api/v1/admin/jobs", auth, requireRole(...editors), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = jobInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const { qualifications = [], documents = [], ...fields } = parsed.data;
  const job = await prisma.job.create({ data: { ...fields, ageCutoffDate: fields.ageCutoffDate ? new Date(fields.ageCutoffDate) : null, applicationStart: fields.applicationStart ? new Date(fields.applicationStart) : null, applicationEnd: fields.applicationEnd ? new Date(fields.applicationEnd) : null, examDate: fields.examDate ? new Date(fields.examDate) : null, notificationDate: fields.notificationDate ? new Date(fields.notificationDate) : null, status: "DRAFT", verificationStatus: "UNVERIFIED", qualifications: { create: qualifications }, documents: { create: documents } } });
  await prisma.auditLog.create({ data: { actorId: req.claims!.sub, jobId: job.id, action: "JOB_CREATED", entityType: "Job", entityId: job.id } });
  return res.status(201).json({ data: job });
}));
app.patch("/api/v1/admin/jobs/:id", auth, requireRole(...editors), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const parsed = jobInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const before = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  const { qualifications, documents, ...fields } = parsed.data;
  const dateFields = ["ageCutoffDate", "applicationStart", "applicationEnd", "examDate", "notificationDate"] as const;
  const data: Record<string, unknown> = { ...fields };
  for (const field of dateFields) if (fields[field] !== undefined) data[field] = fields[field] ? new Date(fields[field]!) : null;
  if (qualifications) data.qualifications = { deleteMany: {}, create: qualifications };
  if (documents) data.documents = { deleteMany: {}, create: documents };
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.job.update({ where: { id: before.id }, data });
    await tx.auditLog.create({ data: { actorId: req.claims!.sub, jobId: before.id, action: "JOB_UPDATED", entityType: "Job", entityId: before.id, changes: { fields: Object.keys(parsed.data) } } });
    return result;
  });
  return res.json({ data: updated });
}));
app.post("/api/v1/admin/jobs/:id/publish", auth, requireRole(...editors), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  if (!job.sourceUrl || !job.sourceOrganization || !job.notificationUrl || !job.applicationUrl) return res.status(422).json({ error: "OFFICIAL_SOURCE_REQUIRED", message: "Add the source organization, official source, notification and application links before publishing." });
  if (!job.lastVerifiedAt || job.verificationStatus !== "VERIFIED" || job.sourceKind !== "OFFICIAL") return res.status(422).json({ error: "SOURCE_REVIEW_REQUIRED", message: "Verify the official source and record its verification time before publishing." });
  const published = await prisma.$transaction(async tx => {
    const result = await tx.job.update({ where: { id: job.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: req.claims!.sub, jobId: job.id, action: "JOB_PUBLISHED", entityType: "Job", entityId: job.id } });
    return result;
  });
  return res.json({ data: published });
}));
app.post("/api/v1/admin/jobs/:id/verify-source", auth, requireRole(...editors), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const source = z.object({ sourceUrl: httpUrl, sourceOrganization: z.string().trim().min(2).max(180), notificationUrl: httpUrl, applicationUrl: httpUrl }).safeParse(req.body);
  if (!source.success) return res.status(400).json({ error: "INVALID_SOURCE", details: source.error.flatten() });
  const before = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  const verifiedAt = new Date();
  const job = await prisma.$transaction(async tx => {
    const updated = await tx.job.update({ where: { id: before.id }, data: { ...source.data, sourceKind: "OFFICIAL", verificationStatus: "VERIFIED", lastVerifiedAt: verifiedAt } });
    await tx.auditLog.create({ data: { actorId: req.claims!.sub, jobId: before.id, action: "SOURCE_VERIFIED", entityType: "Job", entityId: before.id, changes: { sourceUrl: source.data.sourceUrl, verifiedAt: verifiedAt.toISOString() } } });
    return updated;
  });
  return res.json({ data: job, verificationStatus: "VERIFIED", lastVerifiedAt: verifiedAt });
}));
app.post("/api/v1/admin/jobs/:id/archive", auth, requireRole(...editors), verifyMutationOrigin, asyncRoute(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "JOB_NOT_FOUND" });
  const archived = await prisma.$transaction(async tx => {
    const result = await tx.job.update({ where: { id: job.id }, data: { status: "ARCHIVED" } });
    await tx.auditLog.create({ data: { actorId: req.claims!.sub, jobId: job.id, action: "JOB_ARCHIVED", entityType: "Job", entityId: job.id } });
    return result;
  });
  return res.json({ data: archived });
}));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (typeof error === "object" && error && "code" in error && error.code === "P2002") return res.status(409).json({ error: "ALREADY_EXISTS" });
  console.error(error);
  return res.status(500).json({ error: "INTERNAL_ERROR", message: "Request could not be completed." });
});

const port = Number(process.env.API_PORT ?? 4000);
app.listen(port, () => console.log(`NaukriSetu API listening on ${port}`));
process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });
