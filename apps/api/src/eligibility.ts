export type Candidate = {
  dateOfBirth?: Date | null;
  qualification?: string | null;
  degree?: string | null;
  branch?: string | null;
  passingYear?: number | null;
  percentage?: number | null;
  category?: string | null;
  state?: string | null;
  experienceMonths?: number | null;
};
export type EligibilityJob = {
  ageMin: number | null;
  ageMax: number | null;
  ageCutoffDate: Date | null;
  ageRelaxation: unknown;
  experienceMinMonths: number | null;
  states: string[];
  lastVerifiedAt: Date | null;
  verificationStatus: string;
  qualifications: { qualification: string; degree: string | null; branch: string | null; minimumPassingYear: number | null; maximumPassingYear: number | null; minimumPercentage: number | null }[];
  documents: { required: boolean | null; condition: string | null }[];
};

export type EligibilityResult = { status: "ELIGIBLE" | "CHECK_MANUALLY" | "NOT_ELIGIBLE"; reasons: string[] };
const clean = (value?: string | null) => (value ?? "").trim().toLocaleLowerCase("en-IN");

function ageOn(dateOfBirth: Date, cutoff: Date): number {
  let age = cutoff.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDifference = cutoff.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDifference < 0 || (monthDifference === 0 && cutoff.getUTCDate() < dateOfBirth.getUTCDate())) age--;
  return age;
}

export function assessEligibility(candidate: Candidate, job: EligibilityJob): EligibilityResult {
  const failed: string[] = [];
  const manual: string[] = [];
  if (job.verificationStatus !== "VERIFIED" || !job.lastVerifiedAt) manual.push("Official source is not yet verified.");

  if (job.ageMin !== null || job.ageMax !== null) {
    if (!candidate.dateOfBirth || !job.ageCutoffDate) manual.push("Age or the official age cut-off date is missing.");
    else {
      const age = ageOn(candidate.dateOfBirth, job.ageCutoffDate);
      if (job.ageMin !== null && age < job.ageMin) failed.push(`Your age is below the prescribed minimum of ${job.ageMin}.`);
      else if (job.ageMax !== null && age > job.ageMax) {
        if (!job.ageRelaxation) failed.push(`Your age is above the prescribed maximum of ${job.ageMax}.`);
      }
    }
  }
  if (job.ageRelaxation) manual.push(candidate.category ? "Category-specific age relaxation must be confirmed against the official notification." : "Your category is needed to check age-relaxation rules in the official notification.");

  if (job.qualifications.length === 0) manual.push("Qualification criteria are not recorded in the listing.");
  else if (!candidate.qualification) manual.push("Your qualification is missing from your profile.");
  else {
    const matches = job.qualifications.some(required => {
      const qualificationMatch = clean(required.qualification) === clean(candidate.qualification);
      const degreeMatch = !required.degree || clean(required.degree) === clean(candidate.degree);
      const branchMatch = !required.branch || clean(required.branch) === clean(candidate.branch);
      const percentageMatch = required.minimumPercentage === null || (candidate.percentage !== null && candidate.percentage !== undefined && candidate.percentage >= required.minimumPercentage);
      const yearMatch = (required.minimumPassingYear === null || (candidate.passingYear !== null && candidate.passingYear !== undefined && candidate.passingYear >= required.minimumPassingYear)) &&
        (required.maximumPassingYear === null || (candidate.passingYear !== null && candidate.passingYear !== undefined && candidate.passingYear <= required.maximumPassingYear));
      return qualificationMatch && degreeMatch && branchMatch && yearMatch && percentageMatch;
    });
    const hasUnverifiablePercentageRule = job.qualifications.some(q => q.minimumPercentage !== null && candidate.percentage == null);
    const hasUnverifiableYearRule = job.qualifications.some(q => (q.minimumPassingYear !== null || q.maximumPassingYear !== null) && candidate.passingYear == null);
    if (!matches && (hasUnverifiableYearRule || hasUnverifiablePercentageRule)) {
      if (hasUnverifiableYearRule) manual.push("Passing-year eligibility needs your passing year to be confirmed.");
      if (hasUnverifiablePercentageRule) manual.push("Minimum percentage eligibility needs your percentage to be confirmed.");
    }
    else if (!matches) failed.push("Your education details do not match the listed qualification criteria.");
  }

  if (job.states.length) {
    if (!candidate.state) manual.push("Your state is missing from your profile.");
    else if (!job.states.some(state => clean(state) === clean(candidate.state))) failed.push("This recruitment is not listed for your state.");
  }
  if (job.experienceMinMonths !== null) {
    if (candidate.experienceMonths === null || candidate.experienceMonths === undefined) manual.push("Required experience needs to be confirmed.");
    else if (candidate.experienceMonths < job.experienceMinMonths) failed.push(`The listed minimum experience is ${job.experienceMinMonths} months.`);
  }
  if (job.documents.some(document => document.required === null || document.condition)) manual.push("Document or conditional requirements need a manual check in the notification.");

  if (manual.length) return { status: "CHECK_MANUALLY", reasons: [...manual, ...failed.map(reason => `Recorded criteria may not cover every condition: ${reason}`)] };
  if (failed.length) return { status: "NOT_ELIGIBLE", reasons: failed };
  return { status: "ELIGIBLE", reasons: ["Your provided profile matches the recorded age, qualification, location, and experience criteria. Review the official notification before applying."] };
}
