export type EvidenceDecision = "pending" | "confirmed" | "rejected";

export type EvidenceArtifactKind = "document" | "image" | "video" | "link";

export type EvidenceSkill = {
  id: string;
  name: string;
  type: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  apiVersion: string;
  confidence?: number | null;
};

export type EvidenceSkillDecision = {
  skill: EvidenceSkill;
  decision: EvidenceDecision;
  origin: "ai" | "manual" | "required";
};

export type ApplicationEvidenceArtifact = {
  id: string;
  kind: EvidenceArtifactKind;
  name: string;
  file?: File;
  url?: string;
  fileSize: number | null;
  createdAt: string;
  description: string;
  suggestions: EvidenceSkillDecision[];
  status: "processing" | "review" | "manual" | "confirmed" | "error";
  error?: string;
  origin: "general" | "tier2";
  requiredSkillName?: string;
};

export type PortfolioEvidenceItem = {
  id: string;
  kind: "proof" | "video";
  name: string;
  description: string;
  url: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
  validationStatus: string | null;
};

export type PortfolioEvidenceSkill = {
  id: string;
  name: string;
  lightcastId: string | null;
  lightcastType: string | null;
  lightcastDescription: string | null;
  lightcastApiVersion: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  proofs: PortfolioEvidenceItem[];
  videos: PortfolioEvidenceItem[];
};

export type PortfolioSkillSelection = {
  skillId: string;
  skillName: string;
  tier: 1 | 3;
  included: boolean;
  evidenceId: string | null;
  evidenceKind: "proof" | "video" | null;
  evidence: PortfolioEvidenceItem | null;
  description: string;
};

export type ApplicationEvidenceState = {
  artifacts: ApplicationEvidenceArtifact[];
  portfolioSelections: PortfolioSkillSelection[];
};

export type JobEvidenceSkill = {
  id: string;
  name: string;
  lightcastCategoryId?: string | null;
  lightcastCategoryName?: string | null;
  lightcastSubcategoryId?: string | null;
  lightcastSubcategoryName?: string | null;
};

export const EMPTY_APPLICATION_EVIDENCE: ApplicationEvidenceState = {
  artifacts: [],
  portfolioSelections: [],
};

export function normalizeEvidenceSkill(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function confirmedArtifactSkills(artifact: ApplicationEvidenceArtifact) {
  if (artifact.status !== "confirmed") return [];
  return artifact.suggestions
    .filter((suggestion) => suggestion.decision === "confirmed")
    .map((suggestion) => suggestion.skill);
}

export function newestEligibleEvidence(
  skill: PortfolioEvidenceSkill,
): PortfolioEvidenceItem | null {
  return [...skill.proofs, ...skill.videos]
    .filter(
      (item) =>
        item.kind === "video" ||
        normalizeEvidenceSkill(item.validationStatus ?? "") !== "rejected",
    )
    .sort((left, right) => {
      const timeDifference =
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return timeDifference || right.id.localeCompare(left.id);
    })[0] ?? null;
}

export function classifyRequiredSkills(
  required: JobEvidenceSkill[],
  portfolio: PortfolioEvidenceSkill[],
) {
  const portfolioByName = new Map(
    portfolio.map((skill) => [normalizeEvidenceSkill(skill.name), skill]),
  );
  const tier1: Array<{
    required: JobEvidenceSkill;
    portfolioSkill: PortfolioEvidenceSkill;
    evidence: PortfolioEvidenceItem;
  }> = [];
  const tier2: JobEvidenceSkill[] = [];

  for (const skill of required) {
    const portfolioSkill = portfolioByName.get(normalizeEvidenceSkill(skill.name));
    const evidence = portfolioSkill ? newestEligibleEvidence(portfolioSkill) : null;
    if (portfolioSkill && evidence) {
      tier1.push({ required: skill, portfolioSkill, evidence });
    } else {
      tier2.push(skill);
    }
  }

  return { tier1, tier2 };
}

function relatedScore(
  portfolio: PortfolioEvidenceSkill,
  required: JobEvidenceSkill[],
) {
  if (
    portfolio.subcategoryId &&
    required.some(
      (skill) => skill.lightcastSubcategoryId === portfolio.subcategoryId,
    )
  ) {
    return 2;
  }
  if (
    portfolio.categoryId &&
    required.some((skill) => skill.lightcastCategoryId === portfolio.categoryId)
  ) {
    return 1;
  }
  if (
    portfolio.categoryName &&
    required.some(
      (skill) =>
        normalizeEvidenceSkill(skill.lightcastCategoryName ?? "") ===
        normalizeEvidenceSkill(portfolio.categoryName ?? ""),
    )
  ) {
    return 1;
  }
  return 0;
}

export function rankTier3Skills(
  portfolio: PortfolioEvidenceSkill[],
  required: JobEvidenceSkill[],
) {
  const requiredNames = new Set(required.map((skill) => normalizeEvidenceSkill(skill.name)));
  const eligible = portfolio
    .map((skill, index) => ({ skill, index, evidence: newestEligibleEvidence(skill) }))
    .filter((entry) => !requiredNames.has(normalizeEvidenceSkill(entry.skill.name)));
  const related = eligible
    .map((entry) => ({ ...entry, score: relatedScore(entry.skill, required) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const relatedIds = new Set(related.map((entry) => entry.skill.id));
  const remaining = eligible.filter((entry) => !relatedIds.has(entry.skill.id));
  return { related, remaining };
}

export function addTier3Selection(
  selections: PortfolioSkillSelection[],
  skill: PortfolioEvidenceSkill,
) {
  if (selections.some((selection) => selection.skillId === skill.id)) return selections;
  if (selections.filter((selection) => selection.tier === 3 && selection.included).length >= 3) {
    return selections;
  }
  const evidence = newestEligibleEvidence(skill);
  return [...selections, {
    skillId: skill.id,
    skillName: skill.name,
    tier: 3 as const,
    included: true,
    evidenceId: evidence?.id ?? null,
    evidenceKind: evidence?.kind ?? null,
    evidence,
    description: evidence?.description ?? "",
  }];
}

export function coveredRequiredSkills(
  required: JobEvidenceSkill[],
  state: ApplicationEvidenceState,
) {
  const included = new Set(
    state.portfolioSelections
      .filter((selection) => selection.included && selection.tier === 1)
      .map((selection) => normalizeEvidenceSkill(selection.skillName)),
  );
  for (const artifact of state.artifacts) {
    for (const skill of confirmedArtifactSkills(artifact)) {
      included.add(normalizeEvidenceSkill(skill.name));
    }
  }
  return required.filter((skill) => included.has(normalizeEvidenceSkill(skill.name)));
}

export function serializeApplicationEvidence(state: ApplicationEvidenceState) {
  const artifacts = state.artifacts.flatMap((artifact) => {
    const skills = confirmedArtifactSkills(artifact);
    if (skills.length === 0) return [];
    return [{
      id: artifact.id,
      kind: artifact.kind,
      name: artifact.name,
      url: artifact.url ?? null,
      fileSize: artifact.fileSize,
      createdAt: artifact.createdAt,
      description: artifact.description,
      origin: artifact.origin,
      requiredSkillName: artifact.requiredSkillName ?? null,
      skills,
    }];
  });
  const portfolioSkills = state.portfolioSelections
    .filter((selection) => selection.included)
    .map((selection) => ({ ...selection, included: true as const }));
  const skillNames = [...portfolioSkills.map((selection) => selection.skillName)];
  for (const artifact of artifacts) {
    skillNames.push(...artifact.skills.map((skill) => skill.name));
  }
  const dedupedSkillNames = skillNames.filter(
    (name, index, all) =>
      all.findIndex(
        (candidate) =>
          normalizeEvidenceSkill(candidate) === normalizeEvidenceSkill(name),
      ) === index,
  );
  const portfolioEdits = portfolioSkills.flatMap((selection) =>
    selection.evidenceId && selection.evidenceKind
      ? [{
          skillId: selection.skillId,
          skillName: selection.skillName,
          evidenceId: selection.evidenceId,
          evidenceKind: selection.evidenceKind,
          description: selection.description,
        }]
      : [],
  );
  return { artifacts, portfolioSkills, portfolioEdits, skillNames: dedupedSkillNames };
}
