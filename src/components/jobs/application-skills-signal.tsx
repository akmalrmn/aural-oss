"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  FileImage,
  FileText,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import {
  type Dispatch,
  type DragEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applicationFileFingerprint,
  MAX_APPLICATION_FILES,
  validateApplicationFile,
} from "@/lib/jobs/application-files";
import {
  classifyRequiredSkills,
  addTier3Selection,
  confirmedArtifactSkills,
  coveredRequiredSkills,
  newestEligibleEvidence,
  normalizeEvidenceSkill,
  rankTier3Skills,
  type ApplicationEvidenceArtifact,
  type ApplicationEvidenceState,
  type EvidenceSkill,
  type EvidenceSkillDecision,
  type JobEvidenceSkill,
  type PortfolioEvidenceSkill,
  type PortfolioSkillSelection,
} from "@/lib/jobs/application-evidence-state";
import { cn } from "@/lib/utils";

export type ExtractedApplicationSkill = EvidenceSkill;
export type ApplicationSkillArtifact = ApplicationEvidenceArtifact;

type JobSkill = JobEvidenceSkill & { kind: string; priority: string };

type ReviewTarget =
  | { mode: "artifact"; artifactId: string }
  | { mode: "portfolio"; selection: PortfolioSkillSelection }
  | { mode: "add"; requiredSkill: JobEvidenceSkill };

type Props = {
  jobSlug: string;
  jobSkills: JobSkill[];
  isPortfolioApplicant: boolean;
  portfolioSkills: PortfolioEvidenceSkill[];
  evidence: ApplicationEvidenceState;
  setEvidence: Dispatch<SetStateAction<ApplicationEvidenceState>>;
  resumeAttached: boolean;
  onError: (message: string) => void;
  onConfirmedLink: (url: string) => void;
  onSkip: () => void;
};

function sourceIcon(kind: ApplicationEvidenceArtifact["kind"]) {
  if (kind === "video") return Video;
  if (kind === "image") return FileImage;
  if (kind === "link") return Link2;
  return FileText;
}

function artifactKind(file: File): ApplicationEvidenceArtifact["kind"] {
  if (file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".mp4")) return "video";
  if (file.type.startsWith("image/")) return "image";
  return "document";
}

function customSkill(name: string): EvidenceSkill {
  return {
    id: `custom-${normalizeEvidenceSkill(name).replace(/[^a-z0-9]+/g, "-")}`,
    name: name.trim(),
    type: null,
    description: null,
    categoryId: null,
    categoryName: "Custom skill",
    subcategoryId: null,
    subcategoryName: null,
    apiVersion: "custom",
  };
}

function fileMetadata(artifact: ApplicationEvidenceArtifact) {
  const size = artifact.fileSize
    ? artifact.fileSize >= 1024 * 1024
      ? `${(artifact.fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(artifact.fileSize / 1024))} KB`
    : null;
  const time = new Date(artifact.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return [size, `Added ${time}`].filter(Boolean).join(" · ");
}

function statusLabel(status: ApplicationEvidenceArtifact["status"]) {
  if (status === "processing") return "Processing";
  if (status === "review") return "Review needed";
  if (status === "manual") return "Manual tagging";
  if (status === "confirmed") return "Confirmed";
  return "Needs attention";
}

function upsertDecision(
  decisions: EvidenceSkillDecision[],
  skill: EvidenceSkill,
  decision: EvidenceSkillDecision["decision"],
  origin: EvidenceSkillDecision["origin"] = "ai",
) {
  const key = normalizeEvidenceSkill(skill.name);
  const existing = decisions.findIndex((item) => normalizeEvidenceSkill(item.skill.name) === key);
  if (existing < 0) return [...decisions, { skill, decision, origin }];
  return decisions.map((item, index) =>
    index === existing ? { ...item, skill, decision, origin: item.origin } : item,
  );
}

function SwitchControl({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="relative flex h-11 w-14 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)] focus-visible:ring-offset-2"
    >
      <span aria-hidden="true" className={cn("absolute h-7 w-12 rounded-full transition-colors", checked ? "bg-[var(--skilio-brand)]" : "bg-[var(--skilio-border-strong)]")} />
      <span aria-hidden="true" className={cn("absolute top-3 h-5 w-5 rounded-full bg-white shadow-sm transition-[left]", checked ? "left-8" : "left-2")} />
    </button>
  );
}

export function ApplicationSkillsSignal({
  jobSlug,
  jobSkills,
  isPortfolioApplicant,
  portfolioSkills,
  evidence,
  setEvidence,
  resumeAttached,
  onError,
  onConfirmedLink,
  onSkip,
}: Props) {
  const documentInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<EvidenceSkillDecision[]>([]);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EvidenceSkill[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [portfolioQuery, setPortfolioQuery] = useState("");
  const [showPortfolioSkills, setShowPortfolioSkills] = useState(true);
  const [processingStage, setProcessingStage] = useState(0);
  const pendingFileTargetRef = useRef<JobEvidenceSkill | null>(null);

  const classification = useMemo(() => classifyRequiredSkills(jobSkills, portfolioSkills), [jobSkills, portfolioSkills]);
  const tier3 = useMemo(() => rankTier3Skills(portfolioSkills, jobSkills), [jobSkills, portfolioSkills]);
  const covered = useMemo(() => coveredRequiredSkills(jobSkills, evidence), [evidence, jobSkills]);
  const coveredNames = useMemo(() => new Set(covered.map((skill) => normalizeEvidenceSkill(skill.name))), [covered]);
  const selectedTier3 = evidence.portfolioSelections.filter((selection) => selection.tier === 3 && selection.included);
  const activeArtifact = reviewTarget?.mode === "artifact"
    ? evidence.artifacts.find((artifact) => artifact.id === reviewTarget.artifactId)
    : null;
  const activePortfolioSkill = reviewTarget?.mode === "portfolio"
    ? portfolioSkills.find((skill) => skill.id === reviewTarget.selection.skillId)
    : null;
  const activePortfolioEvidence = reviewTarget?.mode === "portfolio" && activePortfolioSkill
    ? [...activePortfolioSkill.proofs, ...activePortfolioSkill.videos]
        .find((item) => item.id === reviewTarget.selection.evidenceId)
    : null;
  const progress = jobSkills.length ? (covered.length / jobSkills.length) * 100 : 0;

  useEffect(() => {
    if (!isPortfolioApplicant || classification.tier1.length === 0) return;
    setEvidence((current) => {
      const known = new Set(current.portfolioSelections.map((item) => item.skillId));
      const additions = classification.tier1.flatMap(({ portfolioSkill, evidence: item }) =>
        known.has(portfolioSkill.id)
          ? []
          : [{
              skillId: portfolioSkill.id,
              skillName: portfolioSkill.name,
              tier: 1 as const,
              included: true,
              evidenceId: item.id,
              evidenceKind: item.kind,
              evidence: item,
              description: item.description,
            }],
      );
      return additions.length ? { ...current, portfolioSelections: [...current.portfolioSelections, ...additions] } : current;
    });
  }, [classification.tier1, isPortfolioApplicant, setEvidence]);

  useEffect(() => {
    if (!evidence.artifacts.some((artifact) => artifact.status === "processing")) return;
    const timer = window.setInterval(() => setProcessingStage((current) => (current + 1) % 3), 900);
    return () => window.clearInterval(timer);
  }, [evidence.artifacts]);

  useEffect(() => {
    const query = skillQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError("");
      try {
        const search = new URLSearchParams({ slug: jobSlug, q: query });
        const response = await fetch(`/api/jobs/application-skill-evidence?${search.toString()}`, { signal: controller.signal });
        const result = (await response.json().catch(() => null)) as { skills?: EvidenceSkill[]; error?: string } | null;
        if (!response.ok) throw new Error(result?.error || "Skill search failed.");
        setSearchResults(result?.skills ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchError(error instanceof Error ? error.message : "Skill search is unavailable.");
      } finally {
        setIsSearching(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [jobSlug, skillQuery]);

  function replaceArtifact(id: string, update: Partial<ApplicationEvidenceArtifact>) {
    setEvidence((current) => ({
      ...current,
      artifacts: current.artifacts.map((artifact) => artifact.id === id ? { ...artifact, ...update } : artifact),
    }));
  }

  function openArtifactReview(artifact: ApplicationEvidenceArtifact) {
    setReviewTarget({ mode: "artifact", artifactId: artifact.id });
    setReviewDecisions(artifact.suggestions);
    setDescriptionDraft(artifact.description);
    setSkillQuery("");
    setSearchResults([]);
    setSearchError("");
  }

  async function analyzeArtifact(artifact: ApplicationEvidenceArtifact) {
    try {
      let response: Response;
      if (artifact.file) {
        const body = new FormData();
        body.set("slug", jobSlug);
        body.set("file", artifact.file);
        response = await fetch("/api/jobs/application-skill-evidence", { method: "POST", body });
      } else {
        response = await fetch("/api/jobs/application-skill-evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: jobSlug, url: artifact.url }),
        });
      }
      const result = (await response.json().catch(() => null)) as {
        skills?: EvidenceSkill[];
        summary?: string;
        sourceName?: string;
        sourceUrl?: string | null;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(result?.error || "Evidence analysis failed.");
      let suggestions: EvidenceSkillDecision[] = (result?.skills ?? []).map((skill) => ({ skill, decision: "pending", origin: "ai" }));
      if (artifact.requiredSkillName) {
        const required = suggestions.find((item) => normalizeEvidenceSkill(item.skill.name) === normalizeEvidenceSkill(artifact.requiredSkillName ?? ""))?.skill ?? customSkill(artifact.requiredSkillName);
        suggestions = upsertDecision(suggestions, required, "confirmed", "required");
      }
      const completed: ApplicationEvidenceArtifact = {
        ...artifact,
        name: result?.sourceName || artifact.name,
        url: result?.sourceUrl || artifact.url,
        suggestions,
        description: result?.summary || "",
        status: "review",
        error: undefined,
      };
      setEvidence((current) => ({
        ...current,
        artifacts: current.artifacts.map((item) => item.id === artifact.id ? completed : item),
      }));
      openArtifactReview(completed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not analyze this evidence. Add its skills manually.";
      const suggestions: EvidenceSkillDecision[] = artifact.requiredSkillName
        ? [{ skill: customSkill(artifact.requiredSkillName), decision: "confirmed", origin: "required" }]
        : [];
      const failed = { ...artifact, status: "manual" as const, suggestions, error: message };
      setEvidence((current) => ({
        ...current,
        artifacts: current.artifacts.map((item) => item.id === artifact.id ? failed : item),
      }));
      onError(message);
      openArtifactReview(failed);
    }
  }

  function chooseFile(file?: File, target?: JobEvidenceSkill | null) {
    const requiredSkill = target === undefined ? pendingFileTargetRef.current : target;
    pendingFileTargetRef.current = null;
    if (!file) return;
    onError("");
    const validationError = validateApplicationFile(file, "skill_artifact");
    if (validationError) {
      onError(validationError);
      return;
    }
    if (evidence.artifacts.some((artifact) => artifact.file && applicationFileFingerprint(artifact.file) === applicationFileFingerprint(file))) {
      onError("That evidence file is already attached.");
      return;
    }
    const attachedFileCount = evidence.artifacts.filter((artifact) => artifact.file).length;
    if (attachedFileCount + (resumeAttached ? 1 : 0) >= MAX_APPLICATION_FILES) {
      onError(`You can attach up to ${MAX_APPLICATION_FILES} files to one application.`);
      return;
    }
    const kind = artifactKind(file);
    const artifact: ApplicationEvidenceArtifact = {
      id: window.crypto.randomUUID(),
      kind,
      name: file.name,
      file,
      fileSize: file.size,
      createdAt: new Date().toISOString(),
      description: "",
      suggestions: requiredSkill
        ? [{ skill: customSkill(requiredSkill.name), decision: "confirmed", origin: "required" }]
        : [],
      status: kind === "video" ? "manual" : "processing",
      origin: requiredSkill ? "tier2" : "general",
      requiredSkillName: requiredSkill?.name,
    };
    setEvidence((current) => ({ ...current, artifacts: [...current.artifacts, artifact] }));
    setReviewTarget(null);
    if (kind === "video") openArtifactReview(artifact);
    else void analyzeArtifact(artifact);
  }

  function addLink(requiredSkill?: JobEvidenceSkill) {
    const raw = linkValue.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const artifact: ApplicationEvidenceArtifact = {
      id: window.crypto.randomUUID(),
      kind: "link",
      name: url,
      url,
      fileSize: null,
      createdAt: new Date().toISOString(),
      description: "",
      suggestions: requiredSkill
        ? [{ skill: customSkill(requiredSkill.name), decision: "confirmed", origin: "required" }]
        : [],
      status: "processing",
      origin: requiredSkill ? "tier2" : "general",
      requiredSkillName: requiredSkill?.name,
    };
    setEvidence((current) => ({ ...current, artifacts: [...current.artifacts, artifact] }));
    setLinkValue("");
    setShowLinkInput(false);
    setReviewTarget(null);
    void analyzeArtifact(artifact);
  }

  function saveReview() {
    if (!reviewTarget) return;
    if (reviewTarget.mode === "portfolio") {
      setEvidence((current) => ({
        ...current,
        portfolioSelections: current.portfolioSelections.map((selection) =>
          selection.skillId === reviewTarget.selection.skillId
            ? { ...selection, description: descriptionDraft.trim() }
            : selection,
        ),
      }));
      setReviewTarget(null);
      return;
    }
    if (reviewTarget.mode !== "artifact" || !activeArtifact) return;
    if (!reviewDecisions.some((item) => item.decision === "confirmed")) return;
    replaceArtifact(activeArtifact.id, {
      suggestions: reviewDecisions,
      description: descriptionDraft.trim(),
      status: "confirmed",
      error: undefined,
    });
    onError("");
    if (activeArtifact.url) onConfirmedLink(activeArtifact.url);
    setReviewTarget(null);
  }

  function removeConfirmedSkill(artifactId: string, skillName: string) {
    setEvidence((current) => ({
      ...current,
      artifacts: current.artifacts.map((artifact) => {
        if (artifact.id !== artifactId) return artifact;
        const suggestions = artifact.suggestions.map((item) =>
          normalizeEvidenceSkill(item.skill.name) === normalizeEvidenceSkill(skillName)
            ? { ...item, decision: "rejected" as const }
            : item,
        );
        return {
          ...artifact,
          suggestions,
          status: suggestions.some((item) => item.decision === "confirmed") ? artifact.status : "review",
        };
      }),
    }));
  }

  function toggleTier1(selection: PortfolioSkillSelection) {
    setEvidence((current) => ({
      ...current,
      portfolioSelections: current.portfolioSelections.map((item) =>
        item.skillId === selection.skillId ? { ...item, included: !item.included } : item,
      ),
    }));
  }

  function addTier3(skill: PortfolioEvidenceSkill) {
    setEvidence((current) => ({
      ...current,
      portfolioSelections: addTier3Selection(current.portfolioSelections, skill),
    }));
  }

  const processingCopy = [
    ["Reading your evidence", "Finding the work and experience described"],
    ["Extracting skill signals", "Matching against the Skilio skills catalogue"],
    ["Preparing your review", "Nothing is shared until you confirm it"],
  ][processingStage];

  return (
    <div className="space-y-7">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold text-[var(--skilio-ink)]">Submit Skills Evidence</h2>
          <Badge className="rounded-md bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control-strong)]">Optional</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
          Show how your work connects to this role. Only the skills and evidence you explicitly confirm will be shared with the hiring team.
        </p>
      </header>

      {jobSkills.length > 0 && (
        <section aria-labelledby="required-skills-heading" className="rounded-[var(--skilio-radius-lg)] bg-[var(--skilio-control)] p-4 sm:p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 id="required-skills-heading" className="font-semibold text-[var(--skilio-ink)]">Required skills</h3>
              <p className="mt-1 text-xs text-[var(--skilio-ink-muted)]">Every skill selected by the employer is shown here.</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--skilio-brand-strong)]">{covered.length} of {jobSkills.length} covered</span>
          </div>
          <div role="progressbar" aria-label="Required skills covered" aria-valuemin={0} aria-valuemax={jobSkills.length} aria-valuenow={covered.length} aria-valuetext={`${covered.length} of ${jobSkills.length} covered`} className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--skilio-border-strong)]">
            <div className="h-full rounded-full bg-[var(--skilio-brand)] transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {jobSkills.map((skill) => {
              const isCovered = coveredNames.has(normalizeEvidenceSkill(skill.name));
              return (
                <span key={skill.id} className={cn(
                  "inline-flex items-center gap-1.5 rounded-[var(--skilio-radius-sm)] border px-2.5 py-1.5 text-xs font-semibold",
                  isCovered
                    ? "border-[var(--skilio-brand)] bg-[var(--skilio-elevated)] text-[var(--skilio-brand-strong)]"
                    : "border-[var(--skilio-border-strong)] bg-[var(--skilio-panel)] text-[var(--skilio-ink-soft)]",
                )}>
                  {isCovered && <Check className="h-3.5 w-3.5" />}{skill.name}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {isPortfolioApplicant && classification.tier1.length > 0 && (
        <section aria-labelledby="portfolio-matches-heading">
          <div className="mb-3">
            <h3 id="portfolio-matches-heading" className="text-base font-semibold text-[var(--skilio-ink)]">Covered by your portfolio</h3>
            <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">Newest eligible evidence is included by default. Turn a skill off to keep it out of this application.</p>
          </div>
          <div className="divide-y divide-[var(--skilio-border)] border-y border-[var(--skilio-border)]">
            {classification.tier1.map(({ portfolioSkill, evidence: item }) => {
              const selection = evidence.portfolioSelections.find((entry) => entry.skillId === portfolioSkill.id) ?? {
                skillId: portfolioSkill.id,
                skillName: portfolioSkill.name,
                tier: 1 as const,
                included: true,
                evidenceId: item.id,
                evidenceKind: item.kind,
                evidence: item,
                description: item.description,
              };
              return (
                <article key={portfolioSkill.id} className={cn("py-4", !selection.included && "rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] px-3")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[var(--skilio-ink)]">{portfolioSkill.name}</span>
                        <Badge className="rounded-md bg-[var(--skilio-control-strong)] text-xs text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control-strong)]">Portfolio evidence</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-[var(--skilio-ink-soft)]">{item.fileName || item.name}</p>
                      {selection.description && <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--skilio-ink-muted)]">{selection.description}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {selection.included && (
                        <button type="button" onClick={() => {
                          setDescriptionDraft(selection.description);
                          setReviewTarget({ mode: "portfolio", selection });
                        }} className="min-h-10 px-2 text-sm font-medium text-[var(--skilio-brand-strong)] hover:underline">Edit</button>
                      )}
                      <SwitchControl checked={selection.included} label={`${selection.included ? "Exclude" : "Include"} ${portfolioSkill.name}`} onChange={() => toggleTier1(selection)} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {isPortfolioApplicant && classification.tier2.length > 0 && (
        <section aria-labelledby="skill-gaps-heading">
          <div className="mb-3">
            <h3 id="skill-gaps-heading" className="text-base font-semibold text-[var(--skilio-ink)]">Add evidence for role gaps</h3>
            <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">These required skills do not yet have eligible proof in your portfolio.</p>
          </div>
          <div className="space-y-2">
            {classification.tier2.map((skill) => {
              const added = evidence.artifacts.some((artifact) =>
                confirmedArtifactSkills(artifact).some((item) => normalizeEvidenceSkill(item.name) === normalizeEvidenceSkill(skill.name)),
              );
              return (
                <div key={skill.id} className="flex items-center justify-between gap-4 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--skilio-ink)]">{skill.name}</p>
                    {added && <p className="mt-0.5 text-xs font-medium text-[var(--skilio-brand-strong)]">Evidence added for this application</p>}
                  </div>
                  <Button type="button" size="sm" variant={added ? "outline" : "default"} onClick={() => {
                    setLinkValue("");
                    setReviewTarget({ mode: "add", requiredSkill: skill });
                  }} className={cn(!added && "bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]")}>
                    {added ? "Add another" : "Add evidence"}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isPortfolioApplicant && (tier3.related.length > 0 || tier3.remaining.length > 0) && (
        <section aria-labelledby="other-portfolio-heading" className="rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)]">
          <button type="button" onClick={() => setShowPortfolioSkills((current) => !current)} aria-expanded={showPortfolioSkills} className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left">
            <span>
              <span id="other-portfolio-heading" className="block text-sm font-semibold text-[var(--skilio-ink)]">Other portfolio skills</span>
              <span className="mt-0.5 block text-xs text-[var(--skilio-ink-muted)]">Choose up to three · {selectedTier3.length} of 3 selected</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showPortfolioSkills && "rotate-180")} />
          </button>
          {showPortfolioSkills && (
            <div className="border-t border-[var(--skilio-border)] p-4">
              <label htmlFor="portfolio-skill-search" className="sr-only">Search portfolio skills</label>
              <Input id="portfolio-skill-search" value={portfolioQuery} onChange={(event) => setPortfolioQuery(event.target.value)} placeholder="Search your portfolio skills" />
              {selectedTier3.length > 0 && (
                <div className="mt-4 space-y-3">
                  {selectedTier3.map((selection) => {
                    const portfolioSkill = portfolioSkills.find((skill) => skill.id === selection.skillId);
                    const item = portfolioSkill ? newestEligibleEvidence(portfolioSkill) : null;
                    return (
                      <article key={selection.skillId} className="rounded-[var(--skilio-radius-md)] bg-[var(--skilio-elevated)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--skilio-ink)]">{selection.skillName}</p>
                            <p className="mt-0.5 text-xs text-[var(--skilio-ink-muted)]">{item?.fileName || item?.name || "Attach evidence in your portfolio"}</p>
                          </div>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEvidence((current) => ({ ...current, portfolioSelections: current.portfolioSelections.filter((item) => item.skillId !== selection.skillId) }))}>Remove</Button>
                        </div>
                        <label htmlFor={`tier3-description-${selection.skillId}`} className="sr-only">Evidence write-up for {selection.skillName}</label>
                        <Textarea id={`tier3-description-${selection.skillId}`} value={selection.description} onChange={(event) => setEvidence((current) => ({ ...current, portfolioSelections: current.portfolioSelections.map((item) => item.skillId === selection.skillId ? { ...item, description: event.target.value } : item) }))} className="mt-3 min-h-20" placeholder="Add a short write-up for this evidence." />
                      </article>
                    );
                  })}
                </div>
              )}
              {([
                { title: "Related to this role", items: tier3.related },
                { title: "All other portfolio skills", items: tier3.remaining },
              ] as const).map((group) => {
                const items = group.items.filter(({ skill }) => !portfolioQuery.trim() || normalizeEvidenceSkill(skill.name).includes(normalizeEvidenceSkill(portfolioQuery)));
                if (items.length === 0) return null;
                return (
                  <div key={group.title} className="mt-4">
                    <p className="text-xs font-semibold text-[var(--skilio-ink-muted)]">{group.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {items.map(({ skill }) => {
                        const selected = selectedTier3.some((item) => item.skillId === skill.id);
                        const disabled = !selected && selectedTier3.length >= 3;
                        return (
                          <button key={skill.id} type="button" aria-pressed={selected} disabled={disabled} onClick={() => selected ? setEvidence((current) => ({ ...current, portfolioSelections: current.portfolioSelections.filter((item) => item.skillId !== skill.id) })) : addTier3(skill)} className={cn("min-h-11 rounded-[var(--skilio-radius-sm)] border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)]", selected ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]" : "border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)]", disabled && "cursor-not-allowed opacity-40")}>
                            {selected ? "✓" : "+"} {skill.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="add-evidence-heading" className="space-y-3">
        <div>
          <h3 id="add-evidence-heading" className="text-base font-semibold text-[var(--skilio-ink)]">Add evidence</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">Documents, links, and images are analysed for suggestions. Videos are tagged manually.</p>
        </div>
        <div
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false); }}
          onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); chooseFile(event.dataTransfer.files?.[0], null); }}
          className={cn(
            "rounded-[var(--skilio-radius-lg)] border border-dashed px-5 py-6 text-center transition-colors sm:px-8",
            isDragging ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)]" : "border-[var(--skilio-border-strong)] bg-[var(--skilio-control)]",
          )}
        >
          <UploadCloud className="mx-auto h-7 w-7 text-[var(--skilio-brand)]" />
          <p className="mt-2 text-sm font-semibold text-[var(--skilio-ink)]">Drop one file here, or choose how to add it</p>
          <p className="mt-1 text-xs leading-5 text-[var(--skilio-ink-muted)]">PDF, DOCX, PNG, JPG, WEBP, or MP4 · up to 100 MB</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" onClick={() => { pendingFileTargetRef.current = null; documentInputRef.current?.click(); }} className="gap-2"><Paperclip className="h-4 w-4" /> Upload file</Button>
            <Button type="button" variant="outline" onClick={() => setShowLinkInput((current) => !current)} className="gap-2"><Link2 className="h-4 w-4" /> Add link</Button>
            <Button type="button" variant="outline" onClick={() => { pendingFileTargetRef.current = null; videoInputRef.current?.click(); }} className="gap-2"><Video className="h-4 w-4" /> Add video</Button>
          </div>
        </div>
        {showLinkInput && (
          <div className="flex flex-col gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] p-3 sm:flex-row">
            <label htmlFor="application-evidence-link" className="sr-only">Portfolio or case-study link</label>
            <Input id="application-evidence-link" autoFocus value={linkValue} onChange={(event) => setLinkValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } }} placeholder="https://portfolio.example.com/case-study" />
            <Button type="button" onClick={() => addLink()} disabled={!linkValue.trim()} className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">Analyse link</Button>
          </div>
        )}
        <button type="button" onClick={onSkip} className="min-h-10 text-sm font-medium text-[var(--skilio-ink-soft)] underline-offset-4 hover:text-[var(--skilio-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)]">Skip this step</button>
      </section>

      {evidence.artifacts.length > 0 && (
        <section aria-labelledby="evidence-list-heading">
          <div className="mb-3 flex items-baseline gap-2">
            <h3 id="evidence-list-heading" className="text-base font-semibold text-[var(--skilio-ink)]">Your evidence</h3>
            <span className="text-xs text-[var(--skilio-ink-muted)]">Only confirmed associations are submitted</span>
          </div>
          <div className="space-y-3">
            {evidence.artifacts.map((artifact) => {
              const Icon = sourceIcon(artifact.kind);
              const confirmed = confirmedArtifactSkills(artifact);
              const pending = artifact.suggestions.filter((item) => item.decision === "pending");
              return (
                <article key={artifact.id} className={cn("rounded-[var(--skilio-radius-lg)] border p-4", confirmed.length > 0 ? "border-[var(--skilio-brand)] bg-[var(--skilio-elevated)]" : "border-[var(--skilio-border)] bg-[var(--skilio-control)]")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control)] text-[var(--skilio-brand)]"><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--skilio-ink)]">{artifact.name}</p><p className="mt-0.5 text-xs text-[var(--skilio-ink-muted)]">{fileMetadata(artifact)}</p></div>
                    </div>
                    <Badge className={cn("shrink-0 rounded-md text-xs", artifact.status === "confirmed" ? "bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]" : artifact.status === "error" ? "bg-[var(--skilio-danger-soft)] text-[var(--skilio-danger)]" : "bg-[var(--skilio-panel)] text-[var(--skilio-ink-soft)]")}>{statusLabel(artifact.status)}</Badge>
                  </div>
                  {artifact.status === "processing" ? (
                    <div className="mt-4 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] p-4" role="status">
                      <div className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-[var(--skilio-brand)]" /><div className="flex-1"><p className="text-sm font-semibold">{processingCopy?.[0]}</p><p className="mt-0.5 text-xs text-[var(--skilio-ink-muted)]">{processingCopy?.[1]}</p></div><Loader2 className="h-4 w-4 animate-spin text-[var(--skilio-brand)] motion-reduce:animate-none" /></div>
                    </div>
                  ) : (
                    <>
                      {artifact.description && <p className="mt-3 text-sm leading-6 text-[var(--skilio-ink-soft)]">{artifact.description}</p>}
                      {artifact.error && <p role="alert" className="mt-3 text-sm text-[var(--skilio-danger)]">{artifact.error}</p>}
                      {(confirmed.length > 0 || pending.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {confirmed.map((skill) => (
                            <button key={skill.name} type="button" onClick={() => removeConfirmedSkill(artifact.id, skill.name)} aria-label={`Remove ${skill.name} from ${artifact.name}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] px-2.5 text-xs font-semibold text-[var(--skilio-brand-strong)]">{jobSkills.some((required) => normalizeEvidenceSkill(required.name) === normalizeEvidenceSkill(skill.name)) ? "Required" : "Extra"} · {skill.name}<X className="h-3.5 w-3.5" /></button>
                          ))}
                          {pending.map(({ skill }) => <span key={skill.name} className="inline-flex min-h-8 items-center rounded-[var(--skilio-radius-sm)] border border-dashed border-[var(--skilio-border-strong)] px-2.5 text-xs text-[var(--skilio-ink-muted)]">{jobSkills.some((required) => normalizeEvidenceSkill(required.name) === normalizeEvidenceSkill(skill.name)) ? "Required" : "Extra"} suggestion · {skill.name}</span>)}
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => openArtifactReview(artifact)} className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">{confirmed.length ? "Edit confirmation" : "Review skills"}</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => { onError(""); setEvidence((current) => ({ ...current, artifacts: current.artifacts.filter((item) => item.id !== artifact.id) })); }}>Remove upload</Button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-start gap-3 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] px-4 py-3 text-sm leading-6 text-[var(--skilio-ink-soft)]">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--skilio-brand)]" />
        <p>Submitting creates or updates your Skilio portfolio automatically. Pending or rejected suggestions and excluded portfolio skills are never shared.</p>
      </div>

      <input ref={documentInputRef} type="file" aria-label="Upload an evidence file" tabIndex={-1} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      <input ref={videoInputRef} type="file" aria-label="Upload a video as evidence" tabIndex={-1} accept=".mp4,video/mp4" className="sr-only" onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />

      <Dialog open={Boolean(reviewTarget)} onOpenChange={(open) => { if (!open) { setReviewTarget(null); pendingFileTargetRef.current = null; } }}>
        <DialogContent className="skilio-interface max-h-[90vh] max-w-xl overflow-y-auto rounded-[var(--skilio-radius-lg)] border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-5 shadow-[var(--skilio-shadow-2)] sm:p-6">
          {reviewTarget?.mode === "add" ? (
            <>
              <DialogHeader><DialogTitle>Add evidence for {reviewTarget.requiredSkill.name}</DialogTitle><DialogDescription>Choose a source. This required skill starts confirmed; you can review any additional AI suggestions before saving.</DialogDescription></DialogHeader>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" className="h-auto min-h-24 flex-col gap-2" onClick={() => { pendingFileTargetRef.current = reviewTarget.requiredSkill; documentInputRef.current?.click(); }}><Paperclip className="h-5 w-5" />File or image</Button>
                <Button type="button" variant="outline" className="h-auto min-h-24 flex-col gap-2" onClick={() => { pendingFileTargetRef.current = reviewTarget.requiredSkill; videoInputRef.current?.click(); }}><Video className="h-5 w-5" />Video</Button>
                <div className="sm:col-span-2"><label htmlFor="gap-evidence-link" className="text-sm font-semibold">Portfolio or case-study link</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input id="gap-evidence-link" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://example.com/work" /><Button type="button" onClick={() => addLink(reviewTarget.requiredSkill)} disabled={!linkValue.trim()} className="bg-[var(--skilio-brand)] text-white">Analyse link</Button></div></div>
              </div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button></DialogFooter>
            </>
          ) : reviewTarget?.mode === "portfolio" ? (
            <>
              <DialogHeader><DialogTitle>Edit portfolio evidence</DialogTitle><DialogDescription>This edits the write-up for the newest evidence item only when you submit the application.</DialogDescription></DialogHeader>
              <div className="rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] p-3">
                <p className="text-sm font-semibold text-[var(--skilio-ink)]">{reviewTarget.selection.skillName}</p>
                <p className="mt-1 truncate text-xs text-[var(--skilio-ink-muted)]">{activePortfolioEvidence?.fileName || activePortfolioEvidence?.name || "Newest portfolio evidence"} · {reviewTarget.selection.evidenceKind}</p>
              </div>
              <div><label htmlFor="portfolio-evidence-description" className="text-sm font-semibold">Evidence write-up</label><Textarea id="portfolio-evidence-description" value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} className="mt-2 min-h-28" /></div>
              <DialogFooter className="gap-2 sm:space-x-0"><Button type="button" variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button><Button type="button" onClick={saveReview} className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">Save edit</Button></DialogFooter>
            </>
          ) : activeArtifact ? (
            <>
              <DialogHeader><DialogTitle>Confirm skills in this evidence</DialogTitle><DialogDescription>Give each suggestion an explicit decision. Pending and rejected skills remain private and are not submitted.</DialogDescription></DialogHeader>
              <div className="flex items-center gap-3 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] px-3 py-2.5 text-sm font-medium"><span className="truncate">{activeArtifact.name}</span></div>
              <div>
                <p className="text-sm font-semibold text-[var(--skilio-ink)]">Skill decisions</p>
                {reviewDecisions.length ? (
                  <div className="mt-2 space-y-2">
                    {reviewDecisions.map((item) => (
                      <div key={item.skill.id || item.skill.name} className="flex flex-col gap-3 rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div><p className="text-sm font-semibold text-[var(--skilio-ink)]">{item.skill.name}</p><p className="mt-0.5 text-xs text-[var(--skilio-ink-muted)]">{jobSkills.some((skill) => normalizeEvidenceSkill(skill.name) === normalizeEvidenceSkill(item.skill.name)) ? "Required for this role" : item.skill.categoryName || "Additional skill"}</p></div>
                        <div className="flex gap-2" role="group" aria-label={`Decision for ${item.skill.name}`}>
                          <button type="button" aria-pressed={item.decision === "confirmed"} onClick={() => setReviewDecisions((current) => upsertDecision(current, item.skill, "confirmed", item.origin))} className={cn("min-h-10 rounded-[var(--skilio-radius-sm)] border px-3 text-xs font-semibold", item.decision === "confirmed" ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]" : "border-[var(--skilio-border-strong)]")}>Confirm</button>
                          <button type="button" aria-pressed={item.decision === "rejected"} onClick={() => setReviewDecisions((current) => upsertDecision(current, item.skill, "rejected", item.origin))} className={cn("min-h-10 rounded-[var(--skilio-radius-sm)] border px-3 text-xs font-semibold", item.decision === "rejected" ? "border-[var(--skilio-danger)] bg-[var(--skilio-danger-soft)] text-[var(--skilio-danger)]" : "border-[var(--skilio-border-strong)]")}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-2 rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control)] p-3 text-sm text-[var(--skilio-ink-soft)]">No automatic suggestions were found. Search for a skill below.</p>}
              </div>
              <div>
                <label htmlFor="application-skill-search" className="text-sm font-semibold">Search for another skill</label>
                <div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--skilio-ink-muted)]" /><Input id="application-skill-search" value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Search the Skilio skill catalogue" className="pl-9 pr-9" />{isSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />}</div>
                {searchError && <p role="alert" className="mt-1 text-xs text-[var(--skilio-danger)]">{searchError}</p>}
                {searchResults.length > 0 && <div className="mt-2 max-h-40 overflow-y-auto rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-border)] p-1">{searchResults.map((skill) => <button key={skill.id} type="button" onClick={() => { setReviewDecisions((current) => upsertDecision(current, skill, "confirmed", "manual")); setSkillQuery(""); setSearchResults([]); }} className="flex min-h-10 w-full items-center justify-between rounded-[var(--skilio-radius-sm)] px-3 text-left text-sm hover:bg-[var(--skilio-control)]">{skill.name}<Plus className="h-4 w-4" /></button>)}</div>}
                {skillQuery.trim().length >= 2 && !searchResults.some((skill) => normalizeEvidenceSkill(skill.name) === normalizeEvidenceSkill(skillQuery)) && <button type="button" onClick={() => { setReviewDecisions((current) => upsertDecision(current, customSkill(skillQuery), "confirmed", "manual")); setSkillQuery(""); }} className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-[var(--skilio-radius-sm)] border border-dashed border-[var(--skilio-border-strong)] px-3 text-left text-sm"><Plus className="h-4 w-4" />Use “{skillQuery.trim()}” as a custom skill</button>}
              </div>
              <div><label htmlFor="application-evidence-description" className="text-sm font-semibold">Evidence write-up</label><p className="mt-0.5 text-xs text-[var(--skilio-ink-muted)]">Edit this before it appears on the evidence card or is shared.</p><Textarea id="application-evidence-description" value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} className="mt-2 min-h-28" placeholder="Briefly explain what this evidence shows." /></div>
              <DialogFooter className="gap-2 sm:space-x-0"><Button type="button" variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button><Button type="button" onClick={saveReview} disabled={!reviewDecisions.some((item) => item.decision === "confirmed")} className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">Save confirmed skills</Button></DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
