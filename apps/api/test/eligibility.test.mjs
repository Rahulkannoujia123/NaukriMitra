import test from "node:test";
import assert from "node:assert/strict";
import { assessEligibility } from "../dist/eligibility.js";

const baseJob = {
  ageMin: 18, ageMax: 30, ageCutoffDate: new Date("2026-01-01"), ageRelaxation: null,
  experienceMinMonths: null, states: [], genderRequirement: null, domicileRequirement: null, nationalityRequirement: null,
  lastVerifiedAt: new Date("2026-01-01"), verificationStatus: "VERIFIED",
  qualifications: [{ qualification: "Graduate", degree: null, branch: null, minimumPassingYear: null, maximumPassingYear: null, minimumPercentage: 60 }],
  documents: []
};

test("percentage below requirement is not eligible", () => {
  const result = assessEligibility({ dateOfBirth: new Date("2000-01-01"), qualification: "Graduate", percentage: 59 }, baseJob);
  assert.equal(result.status, "NOT_ELIGIBLE");
});

test("matching age and percentage is eligible", () => {
  const result = assessEligibility({ dateOfBirth: new Date("2000-01-01"), qualification: "Graduate", percentage: 75 }, baseJob);
  assert.equal(result.status, "ELIGIBLE");
});

test("unknown domicile requirement is manual review", () => {
  const result = assessEligibility({ dateOfBirth: new Date("2000-01-01"), qualification: "Graduate", percentage: 75 }, { ...baseJob, domicileRequirement: "State domicile required" });
  assert.equal(result.status, "CHECK_MANUALLY");
});
