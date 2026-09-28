import { createHash } from "node:crypto";
import { PrismaClient, SourceKind, VerificationStatus, type Prisma } from "@prisma/client";
import { fetchLiveSourceNotices } from "./live-sources";

const prisma = new PrismaClient();

export async function ingestLiveSourceSnapshots() {
  const result = await fetchLiveSourceNotices();
  const observedAt = new Date(result.fetchedAt);
  let imported = 0;

  for (const notice of result.data) {
    const snapshot = {
      title: notice.title,
      organization: notice.organization,
      category: notice.category,
      sourceUrl: notice.url,
      detailUrl: notice.link,
      observedAt: observedAt.toISOString(),
    };
    const contentHash = createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex");

    const previous = await prisma.sourceSnapshot.findFirst({
      where: {
        sourceUrl: notice.url,
        recordType: "LIVE_NOTICE",
        noticeTitle: notice.title,
      },
      orderBy: { observedAt: "desc" },
      select: { contentHash: true },
    });

    await prisma.sourceSnapshot.upsert({
      where: {
        sourceUrl_recordType_noticeTitle: {
          sourceUrl: notice.url,
          recordType: "LIVE_NOTICE",
          noticeTitle: notice.title,
        },
      },
      create: {
        sourceOrganization: notice.organization,
        sourceUrl: notice.url,
        noticeTitle: notice.title,
        recordType: "LIVE_NOTICE",
        detailUrl: notice.link,
        observedAt,
        sourceKind: SourceKind.OFFICIAL,
        verificationStatus: VerificationStatus.REVIEW_REQUIRED,
        extractedFields: ["title", "organization", "category", "sourceUrl", "detailUrl"],
        unverifiedFields: ["vacancy", "qualification", "ageLimit", "salary", "applicationStart", "applicationEnd"],
        retrievalNote: "Automatically collected from an official recruitment source. Review the original notification before publishing as a job record.",
        contentHash,
        previousContentHash: previous?.contentHash ?? null,
        changeSummary:
          previous?.contentHash && previous.contentHash !== contentHash
            ? "Official source notice changed since the previous observation."
            : null,
        snapshot: snapshot as Prisma.InputJsonValue,
      },
      update: {
        detailUrl: notice.link,
        observedAt,
        verificationStatus: VerificationStatus.REVIEW_REQUIRED,
        contentHash,
        previousContentHash: previous?.contentHash ?? null,
        changeSummary:
          previous?.contentHash && previous.contentHash !== contentHash
            ? "Official source notice changed since the previous observation."
            : null,
        snapshot: snapshot as Prisma.InputJsonValue,
      },
    });

    imported++;
  }

  return {
    imported,
    fetchedAt: result.fetchedAt,
    failedCount: result.failedCount,
    note: result.note,
  };
}

export async function disconnectIngestionDatabase() {
  await prisma.$disconnect();
}
