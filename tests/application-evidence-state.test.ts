import assert from "node:assert/strict";
import test from "node:test";
import {
  addTier3Selection,
  classifyRequiredSkills,
  coveredRequiredSkills,
  newestEligibleEvidence,
  rankTier3Skills,
  serializeApplicationEvidence,
  type ApplicationEvidenceArtifact,
  type PortfolioEvidenceSkill,
} from "../src/lib/jobs/application-evidence-state";

const required = [
  { id: "r1", name: "Data Analysis", lightcastCategoryId: "cat-data", lightcastSubcategoryId: "sub-analysis" },
  { id: "r2", name: "Communication", lightcastCategoryId: "cat-people" },
];

function portfolioSkill(
  id: string,
  name: string,
  evidence: Array<{ id: string; kind: "proof" | "video"; date: string; status?: string }> = [],
  categoryId: string | null = null,
  subcategoryId: string | null = null,
): PortfolioEvidenceSkill {
  const items = evidence.map((item) => ({
    id: item.id,
    kind: item.kind,
    name: item.id,
    description: `${item.id} description`,
    url: `https://example.com/${item.id}`,
    fileName: null,
    fileType: null,
    fileSize: null,
    createdAt: item.date,
    validationStatus: item.status ?? null,
  }));
  return {
    id,
    name,
    lightcastId: null,
    lightcastType: null,
    lightcastDescription: null,
    lightcastApiVersion: null,
    categoryId,
    categoryName: null,
    subcategoryId,
    subcategoryName: null,
    proofs: items.filter((item) => item.kind === "proof"),
    videos: items.filter((item) => item.kind === "video"),
  };
}

const aiSkill = {
  id: "lc-data",
  name: "Data Analysis",
  type: "Specialized Skill",
  description: null,
  categoryId: "cat-data",
  categoryName: "Data",
  subcategoryId: "sub-analysis",
  subcategoryName: "Analysis",
  apiVersion: "v1",
};

test("newest evidence ignores rejected proofs but accepts videos", () => {
  const skill = portfolioSkill("s1", "Data Analysis", [
    { id: "older", kind: "proof", date: "2026-01-01T00:00:00.000Z", status: "VALIDATED" },
    { id: "rejected", kind: "proof", date: "2026-03-01T00:00:00.000Z", status: "REJECTED" },
    { id: "video", kind: "video", date: "2026-02-01T00:00:00.000Z" },
  ]);
  assert.equal(newestEligibleEvidence(skill)?.id, "video");
});

test("required skills are Tier 1 only with matching eligible proof", () => {
  const data = portfolioSkill("s1", " data analysis ", [
    { id: "proof", kind: "proof", date: "2026-01-01T00:00:00.000Z", status: "PENDING" },
  ]);
  const communication = portfolioSkill("s2", "Communication");
  const result = classifyRequiredSkills(required, [data, communication]);
  assert.deepEqual(result.tier1.map((item) => item.required.name), ["Data Analysis"]);
  assert.deepEqual(result.tier2.map((item) => item.name), ["Communication"]);
});

test("related Tier 3 skills rank subcategory before category and retain stable order", () => {
  const category = portfolioSkill("a", "Reporting", [{ id: "a-proof", kind: "proof", date: "2026-01-01T00:00:00.000Z" }], "cat-data");
  const subcategory = portfolioSkill("b", "Statistics", [{ id: "b-proof", kind: "proof", date: "2026-01-01T00:00:00.000Z" }], "cat-data", "sub-analysis");
  const other = portfolioSkill("c", "Writing", [{ id: "c-proof", kind: "proof", date: "2026-01-01T00:00:00.000Z" }], "cat-writing");
  const ranked = rankTier3Skills([category, subcategory, other], required);
  assert.deepEqual(ranked.related.map((item) => item.skill.id), ["b", "a"]);
  assert.deepEqual(ranked.remaining.map((item) => item.skill.id), ["c"]);
});

test("Tier 3 selection has a hard cap of three", () => {
  let selections = [] as ReturnType<typeof addTier3Selection>;
  for (let index = 0; index < 4; index += 1) {
    selections = addTier3Selection(
      selections,
      portfolioSkill(`s${index}`, `Skill ${index}`, [{ id: `p${index}`, kind: "proof", date: "2026-01-01T00:00:00.000Z" }]),
    );
  }
  assert.equal(selections.length, 3);
});

test("Tier 3 keeps portfolio skills without evidence and omits nonexistent edits", () => {
  const skill = portfolioSkill("unproven", "Facilitation");
  const ranked = rankTier3Skills([skill], required);
  assert.deepEqual(ranked.remaining.map((item) => item.skill.id), ["unproven"]);

  const selections = addTier3Selection([], skill);
  const serialized = serializeApplicationEvidence({ artifacts: [], portfolioSelections: selections });
  assert.deepEqual(serialized.skillNames, ["Facilitation"]);
  assert.deepEqual(serialized.portfolioEdits, []);
});

test("serialization excludes pending, rejected, removed, and excluded skills", () => {
  const artifact: ApplicationEvidenceArtifact = {
    id: "30f6cd57-0260-48cf-af91-7fc89977374b",
    kind: "document",
    name: "case-study.pdf",
    fileSize: 1200,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: "Evidence write-up",
    status: "confirmed",
    origin: "general",
    suggestions: [
      { skill: aiSkill, decision: "confirmed", origin: "manual" },
      { skill: { ...aiSkill, id: "pending", name: "Pending Skill" }, decision: "pending", origin: "ai" },
      { skill: { ...aiSkill, id: "rejected", name: "Rejected Skill" }, decision: "rejected", origin: "ai" },
    ],
  };
  const serialized = serializeApplicationEvidence({
    artifacts: [artifact, { ...artifact, id: "4ea0bc32-c5bc-4726-b88b-6fc321df40bb", status: "review" }],
    portfolioSelections: [
      { skillId: "included", skillName: "Writing", tier: 3, included: true, evidenceId: "proof", evidenceKind: "proof", evidence: null, description: "Writing proof" },
      { skillId: "excluded", skillName: "Excluded", tier: 1, included: false, evidenceId: "proof2", evidenceKind: "proof", evidence: null, description: "Private" },
    ],
  });
  assert.deepEqual(serialized.skillNames, ["Writing", "Data Analysis"]);
  assert.equal(serialized.artifacts.length, 1);
  assert.equal(serialized.artifacts[0]?.skills.length, 1);
  assert.deepEqual(coveredRequiredSkills(required, { artifacts: [artifact], portfolioSelections: [] }).map((skill) => skill.name), ["Data Analysis"]);
});
