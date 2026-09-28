import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { Prisma, PrismaClient, SourceKind, VerificationStatus } from "@prisma/client";

type Observation = {
  title: string;
  recordType: string;
  publishedAt?: string;
  detailUrl?: string | null;
  applicationUrl?: string | null;
  verificationStatus: string;
  extractedFields: string[];
  unverifiedFields: string[];
  retrievalNote: string;
};
type SourceBatch = {
  collectedAt: string;
  sources: { sourceOrganization: string; sourceUrl: string; observations: Observation[] }[];
};

const prisma = new PrismaClient();
async function main() {
  const batchPath = path.resolve(__dirname, "../data/central-recruitment-source-intake.json");
  const batch = JSON.parse(await readFile(batchPath, "utf8")) as SourceBatch;
  let imported = 0;
  for (const source of batch.sources) {
    for (const observation of source.observations) {
      const contentHash = createHash("sha256").update(JSON.stringify(observation)).digest("hex");
      const previous = await prisma.sourceSnapshot.findFirst({ where: { sourceUrl: source.sourceUrl, recordType: observation.recordType }, orderBy: { observedAt: "desc" } });
      const changed = Boolean(previous && previous.contentHash && previous.contentHash !== contentHash);
      await prisma.sourceSnapshot.upsert({
        where: { sourceUrl_recordType_noticeTitle: { sourceUrl: source.sourceUrl, recordType: observation.recordType, noticeTitle: observation.title } },
        create: {
          sourceOrganization: source.sourceOrganization,
          sourceUrl: source.sourceUrl,
          noticeTitle: observation.title,
          recordType: observation.recordType,
          detailUrl: observation.detailUrl ?? null,
          applicationUrl: observation.applicationUrl ?? null,
          publishedAt: observation.publishedAt ? new Date(observation.publishedAt) : null,
          observedAt: new Date(batch.collectedAt),
          sourceKind: SourceKind.OFFICIAL,
          verificationStatus: VerificationStatus.REVIEW_REQUIRED,
          extractedFields: observation.extractedFields,
          unverifiedFields: observation.unverifiedFields,
          retrievalNote: observation.retrievalNote,
          contentHash,
          previousContentHash: previous?.contentHash ?? null,
          changeSummary: changed ? "Source observation changed since the previous snapshot." : null,
          snapshot: observation as Prisma.InputJsonValue,
        },
        update: {
          detailUrl: observation.detailUrl ?? null,
          applicationUrl: observation.applicationUrl ?? null,
          publishedAt: observation.publishedAt ? new Date(observation.publishedAt) : null,
          observedAt: new Date(batch.collectedAt),
          verificationStatus: VerificationStatus.REVIEW_REQUIRED,
          extractedFields: observation.extractedFields,
          unverifiedFields: observation.unverifiedFields,
          retrievalNote: observation.retrievalNote,
          contentHash,
          previousContentHash: previous?.contentHash ?? null,
          changeSummary: changed ? "Source observation changed since the previous snapshot." : null,
          snapshot: observation as Prisma.InputJsonValue,
        },
      });
      imported++;
    }
  }
  console.log(`Upserted ${imported} official source snapshots as review-required.`);
}
main().catch(error => { console.error("Source intake import failed.", error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
