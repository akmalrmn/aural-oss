"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  UploadCloud,
  Video,
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
import { cn } from "@/lib/utils";

export type ExtractedApplicationSkill = {
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

export type ApplicationSkillArtifact = {
  id: string;
  kind: "document" | "image" | "video" | "link";
  name: string;
  file?: File;
  url?: string;
  skillNames: string[];
  suggestedSkills: ExtractedApplicationSkill[];
  summary: string;
  priorEvidence?: Record<string, string>;
  status: "processing" | "review" | "manual" | "confirmed" | "error";
  error?: string;
};

type JobSkill = {
  id: string;
  name: string;
  kind: string;
  priority: string;
  lightcastCategoryName?: string | null;
};

type Props = {
  jobSlug: string;
  jobSkills: JobSkill[];
  isPortfolioApplicant: boolean;
  portfolioSkills: string[];
  portfolioSkillCategories: Record<string, string>;
  selectedSkills: string[];
  setSelectedSkills: Dispatch<SetStateAction<string[]>>;
  standaloneSkills: string[];
  setStandaloneSkills: Dispatch<SetStateAction<string[]>>;
  skillEvidence: Record<string, string>;
  setSkillEvidence: Dispatch<SetStateAction<Record<string, string>>>;
  artifacts: ApplicationSkillArtifact[];
  setArtifacts: Dispatch<SetStateAction<ApplicationSkillArtifact[]>>;
  resumeAttached: boolean;
  willCreatePortfolio: boolean;
  onError: (message: string) => void;
  onConfirmedLink: (url: string) => void;
};

function normalizeSkill(value: string) {
  return value.trim().toLowerCase();
}

function uniqueSkills(skills: string[]) {
  return skills.filter(
    (skill, index, all) =>
      skill.trim().length > 0 &&
      all.findIndex(
        (candidate) => normalizeSkill(candidate) === normalizeSkill(skill),
      ) === index,
  );
}

function sourceIcon(kind: ApplicationSkillArtifact["kind"]) {
  if (kind === "video") return Video;
  if (kind === "image") return ImageIcon;
  if (kind === "link") return Link2;
  return FileText;
}

function artifactKind(file: File): ApplicationSkillArtifact["kind"] {
  if (file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".mp4")) {
    return "video";
  }
  if (file.type.startsWith("image/")) return "image";
  return "document";
}

function isAutoAnalyzable(file: File) {
  return /\.(pdf|docx|txt)$/i.test(file.name);
}

function sourceDescription(artifact: ApplicationSkillArtifact) {
  if (artifact.kind === "video") return "Video evidence";
  if (artifact.kind === "image") return "Image evidence";
  if (artifact.kind === "link") return "Portfolio or case-study link";
  return "Document evidence";
}

function statusLabel(status: ApplicationSkillArtifact["status"]) {
  if (status === "processing") return "Finding skills";
  if (status === "review") return "Needs your review";
  if (status === "manual") return "Add skills manually";
  if (status === "confirmed") return "Confirmed";
  return "Needs attention";
}

export function ApplicationSkillsSignal({
  jobSlug,
  jobSkills,
  isPortfolioApplicant,
  portfolioSkills,
  portfolioSkillCategories,
  selectedSkills,
  setSelectedSkills,
  standaloneSkills,
  setStandaloneSkills,
  skillEvidence,
  setSkillEvidence,
  artifacts,
  setArtifacts,
  resumeAttached,
  willCreatePortfolio,
  onError,
  onConfirmedLink,
}: Props) {
  const documentInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [modalSkills, setModalSkills] = useState<ExtractedApplicationSkill[]>([]);
  const [modalSelected, setModalSelected] = useState<string[]>([]);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExtractedApplicationSkill[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [manualSkill, setManualSkill] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [showMorePortfolio, setShowMorePortfolio] = useState(false);
  const [portfolioQuery, setPortfolioQuery] = useState("");
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState(0);

  const activeArtifact = artifacts.find(
    (artifact) => artifact.id === activeArtifactId,
  );
  const selectedSet = useMemo(
    () => new Set(selectedSkills.map(normalizeSkill)),
    [selectedSkills],
  );
  const standaloneSet = useMemo(
    () => new Set(standaloneSkills.map(normalizeSkill)),
    [standaloneSkills],
  );
  const portfolioSet = useMemo(
    () => new Set(portfolioSkills.map(normalizeSkill)),
    [portfolioSkills],
  );
  const exactMatches = useMemo(
    () => jobSkills.filter((skill) => portfolioSet.has(normalizeSkill(skill.name))),
    [jobSkills, portfolioSet],
  );
  const requestedSkills = useMemo(
    () => jobSkills.filter((skill) => !portfolioSet.has(normalizeSkill(skill.name))),
    [jobSkills, portfolioSet],
  );
  const relatedMatches = useMemo(() => {
    const exactSet = new Set(exactMatches.map((skill) => normalizeSkill(skill.name)));
    return portfolioSkills.flatMap((skill) => {
      if (exactSet.has(normalizeSkill(skill))) return [];
      const category = Object.entries(portfolioSkillCategories).find(
        ([name]) => normalizeSkill(name) === normalizeSkill(skill),
      )?.[1];
      if (!category) return [];
      const relatedRoleSkill = jobSkills.find(
        (jobSkill) =>
          jobSkill.lightcastCategoryName?.trim().toLowerCase() ===
          category.trim().toLowerCase(),
      );
      return relatedRoleSkill ? [{ skill, relatedTo: relatedRoleSkill.name }] : [];
    });
  }, [exactMatches, jobSkills, portfolioSkillCategories, portfolioSkills]);
  const allOtherPortfolioSkills = useMemo(() => {
    const exactSet = new Set(exactMatches.map((skill) => normalizeSkill(skill.name)));
    const relatedSet = new Set(
      relatedMatches.map((match) => normalizeSkill(match.skill)),
    );
    return portfolioSkills.filter(
      (skill) =>
        !exactSet.has(normalizeSkill(skill)) &&
        !relatedSet.has(normalizeSkill(skill)),
    );
  }, [exactMatches, portfolioSkills, relatedMatches]);
  const otherPortfolioSkills = useMemo(() => {
    const query = normalizeSkill(portfolioQuery);
    return allOtherPortfolioSkills.filter(
      (skill) => !query || normalizeSkill(skill).includes(query),
    );
  }, [allOtherPortfolioSkills, portfolioQuery]);

  useEffect(() => {
    if (!artifacts.some((artifact) => artifact.status === "processing")) return;
    const timer = window.setInterval(
      () => setProcessingStage((current) => (current + 1) % 3),
      900,
    );
    return () => window.clearInterval(timer);
  }, [artifacts]);

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
        const response = await fetch(
          `/api/jobs/application-skill-evidence?${search.toString()}`,
          { signal: controller.signal },
        );
        const result = (await response.json().catch(() => null)) as {
          skills?: ExtractedApplicationSkill[];
          error?: string;
        } | null;
        if (!response.ok) throw new Error(result?.error || "Skill search failed.");
        setSearchResults(result?.skills ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchError(
          error instanceof Error ? error.message : "Skill search is unavailable.",
        );
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [jobSlug, skillQuery]);

  function updateArtifact(
    id: string,
    update: Partial<ApplicationSkillArtifact>,
  ) {
    setArtifacts((current) =>
      current.map((artifact) =>
        artifact.id === id ? { ...artifact, ...update } : artifact,
      ),
    );
  }

  function openReview(
    artifact: ApplicationSkillArtifact,
    suggested = artifact.suggestedSkills,
  ) {
    setActiveArtifactId(artifact.id);
    setModalSkills(suggested);
    setModalSelected(
      artifact.skillNames.length
        ? artifact.skillNames
        : suggested.map((skill) => skill.name),
    );
    setSummaryDraft(artifact.summary);
    setSkillQuery("");
    setSearchResults([]);
    setSearchError("");
  }

  async function analyzeArtifact(artifact: ApplicationSkillArtifact) {
    try {
      let response: Response;
      if (artifact.file) {
        const body = new FormData();
        body.set("slug", jobSlug);
        body.set("file", artifact.file);
        response = await fetch("/api/jobs/application-skill-evidence", {
          method: "POST",
          body,
        });
      } else {
        response = await fetch("/api/jobs/application-skill-evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: jobSlug, url: artifact.url }),
        });
      }

      const result = (await response.json().catch(() => null)) as {
        skills?: ExtractedApplicationSkill[];
        summary?: string;
        sourceName?: string;
        sourceUrl?: string | null;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(result?.error || "Evidence analysis failed.");

      const skills = result?.skills ?? [];
      const completed: ApplicationSkillArtifact = {
        ...artifact,
        name: result?.sourceName || artifact.name,
        url: result?.sourceUrl || artifact.url,
        suggestedSkills: skills,
        skillNames: skills.map((skill) => skill.name),
        summary: result?.summary || artifact.summary,
        status: skills.length ? "review" : "manual",
        error: undefined,
      };
      setArtifacts((current) =>
        current.map((item) => (item.id === artifact.id ? completed : item)),
      );
      openReview(completed, skills);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not analyze this evidence. Add its skills manually or retry.";
      const failed: ApplicationSkillArtifact = {
        ...artifact,
        status: "manual",
        error: message,
        summary: "",
      };
      setArtifacts((current) =>
        current.map((item) => (item.id === artifact.id ? failed : item)),
      );
      onError(message);
      openReview(failed, []);
    }
  }

  function chooseFile(file?: File) {
    if (!file) return;
    onError("");
    const validationError = validateApplicationFile(file, "skill_artifact");
    if (validationError) {
      onError(validationError);
      return;
    }
    if (
      artifacts.some(
        (artifact) =>
          artifact.file &&
          applicationFileFingerprint(artifact.file) ===
            applicationFileFingerprint(file),
      )
    ) {
      onError("That evidence file is already attached.");
      return;
    }
    const attachedFileCount = artifacts.filter((artifact) => artifact.file).length;
    if (attachedFileCount + (resumeAttached ? 1 : 0) >= MAX_APPLICATION_FILES) {
      onError(`You can attach up to ${MAX_APPLICATION_FILES} files to one application.`);
      return;
    }

    const kind = artifactKind(file);
    const canAnalyze = kind === "document" && isAutoAnalyzable(file);
    const artifact: ApplicationSkillArtifact = {
      id: window.crypto.randomUUID(),
      kind,
      name: file.name,
      file,
      skillNames: [],
      suggestedSkills: [],
      summary: "",
      status: canAnalyze ? "processing" : "manual",
    };
    setArtifacts((current) => [...current, artifact]);

    if (canAnalyze) {
      void analyzeArtifact(artifact);
    } else {
      openReview(artifact, []);
    }
  }

  function submitLink() {
    const raw = linkValue.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const artifact: ApplicationSkillArtifact = {
      id: window.crypto.randomUUID(),
      kind: "link",
      name: url,
      url,
      skillNames: [],
      suggestedSkills: [],
      summary: "",
      status: "processing",
    };
    setArtifacts((current) => [...current, artifact]);
    setLinkValue("");
    setShowLinkInput(false);
    void analyzeArtifact(artifact);
  }

  function toggleModalSkill(name: string) {
    setModalSelected((current) =>
      current.some((skill) => normalizeSkill(skill) === normalizeSkill(name))
        ? current.filter((skill) => normalizeSkill(skill) !== normalizeSkill(name))
        : [...current, name],
    );
  }

  function addSearchSkill(skill: ExtractedApplicationSkill) {
    setModalSkills((current) =>
      current.some((item) => normalizeSkill(item.name) === normalizeSkill(skill.name))
        ? current
        : [...current, skill],
    );
    setModalSelected((current) => uniqueSkills([...current, skill.name]));
    setSkillQuery("");
    setSearchResults([]);
  }

  function saveReview() {
    if (!activeArtifact || modalSelected.length === 0) return;
    const selected = uniqueSkills(modalSelected);
    const previousSkills = activeArtifact.skillNames;
    const summary = summaryDraft.trim();
    const priorEvidence = { ...(activeArtifact.priorEvidence ?? {}) };
    selected.forEach((skill) => {
      if (!(skill in priorEvidence)) priorEvidence[skill] = skillEvidence[skill] ?? "";
    });
    updateArtifact(activeArtifact.id, {
      skillNames: selected,
      suggestedSkills: modalSkills,
      summary,
      priorEvidence,
      status: "confirmed",
      error: undefined,
    });
    const otherConfirmedSkills = new Set(
      artifacts
        .filter(
          (artifact) =>
            artifact.id !== activeArtifact.id && artifact.status === "confirmed",
        )
        .flatMap((artifact) => artifact.skillNames)
        .map(normalizeSkill),
    );
    setSelectedSkills((current) =>
      uniqueSkills([...current, ...selected]).filter((skill) => {
        const wasRemoved = previousSkills.some(
          (previous) => normalizeSkill(previous) === normalizeSkill(skill),
        ) && !selected.some(
          (candidate) => normalizeSkill(candidate) === normalizeSkill(skill),
        );
        return (
          !wasRemoved ||
          standaloneSet.has(normalizeSkill(skill)) ||
          otherConfirmedSkills.has(normalizeSkill(skill))
        );
      }),
    );
    setSkillEvidence((current) => {
      const next = { ...current };
      previousSkills.forEach((skill) => {
        if (
          !selected.some(
            (candidate) => normalizeSkill(candidate) === normalizeSkill(skill),
          ) &&
          next[skill] === activeArtifact.summary
        ) {
          const replacement = artifacts.find(
            (artifact) =>
              artifact.id !== activeArtifact.id &&
              artifact.status === "confirmed" &&
              artifact.skillNames.some(
                (candidate) =>
                  normalizeSkill(candidate) === normalizeSkill(skill),
              ),
          );
          const restored = replacement?.summary ?? activeArtifact.priorEvidence?.[skill];
          if (restored) next[skill] = restored;
          else delete next[skill];
        }
      });
      selected.forEach((skill) => {
        if (summary || !next[skill]) next[skill] = summary;
      });
      return next;
    });
    if (activeArtifact.url) onConfirmedLink(activeArtifact.url);
    setActiveArtifactId(null);
  }

  function removeArtifact(artifact: ApplicationSkillArtifact) {
    const otherConfirmedSkills = new Set(
      artifacts
        .filter(
          (item) => item.id !== artifact.id && item.status === "confirmed",
        )
        .flatMap((item) => item.skillNames)
        .map(normalizeSkill),
    );
    const removableSkills = new Set(
      artifact.skillNames
        .map(normalizeSkill)
        .filter(
          (skill) => !standaloneSet.has(skill) && !otherConfirmedSkills.has(skill),
        ),
    );
    setArtifacts((current) => current.filter((item) => item.id !== artifact.id));
    setSelectedSkills((current) =>
      current.filter((skill) => !removableSkills.has(normalizeSkill(skill))),
    );
    setSkillEvidence((current) => {
      const next = { ...current };
      artifact.skillNames.forEach((skill) => {
        if (next[skill] === artifact.summary) {
          const replacement = artifacts.find(
            (item) =>
              item.id !== artifact.id &&
              item.status === "confirmed" &&
              item.skillNames.some(
                (candidate) =>
                  normalizeSkill(candidate) === normalizeSkill(skill),
              ),
          );
          const restored = replacement?.summary ?? artifact.priorEvidence?.[skill];
          if (restored) next[skill] = restored;
          else delete next[skill];
        }
      });
      return next;
    });
    onError("");
  }

  function toggleSelectedSkill(skill: string) {
    if (selectedSet.has(normalizeSkill(skill))) {
      setStandaloneSkills((current) =>
        current.filter((item) => normalizeSkill(item) !== normalizeSkill(skill)),
      );
      const isBackedByArtifact = artifacts.some(
        (artifact) =>
          artifact.status === "confirmed" &&
          artifact.skillNames.some(
            (item) => normalizeSkill(item) === normalizeSkill(skill),
          ),
      );
      if (!isBackedByArtifact) {
        setSelectedSkills((current) =>
          current.filter((item) => normalizeSkill(item) !== normalizeSkill(skill)),
        );
      }
      return;
    }
    setSelectedSkills((current) => uniqueSkills([...current, skill]));
    setStandaloneSkills((current) => uniqueSkills([...current, skill]));
    setSkillEvidence((current) => ({ ...current, [skill]: current[skill] || "" }));
  }

  function addManualSkill() {
    const skill = manualSkill.trim();
    if (!skill) return;
    setSelectedSkills((current) => uniqueSkills([...current, skill]));
    setStandaloneSkills((current) => uniqueSkills([...current, skill]));
    setSkillEvidence((current) => ({ ...current, [skill]: current[skill] || "" }));
    setManualSkill("");
  }

  const processingCopy = [
    ["Reading your evidence", "Finding the work and experience described"],
    ["Extracting skill signals", "Using the same catalogue as your Skilio portfolio"],
    ["Preparing your review", "Matching names and drafting a short write-up"],
  ][processingStage];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold text-[var(--skilio-ink)]">
            {isPortfolioApplicant ? "Submit skills information" : "Add your skills evidence"}
          </h2>
          {!isPortfolioApplicant && (
            <Badge className="rounded-md bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control-strong)]">
              Optional
            </Badge>
          )}
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
          {isPortfolioApplicant
            ? "We matched your Skilio portfolio to this role. Review the matches or add new evidence and we’ll suggest the skills for you."
            : "Upload a CV, project, case study, portfolio link, or short video. We’ll suggest the skills and a write-up for you to confirm."}
        </p>
      </div>

      {isPortfolioApplicant ? (
        <div className="flex flex-col gap-4 rounded-[var(--skilio-radius-lg)] bg-[var(--skilio-control)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-elevated)] text-[var(--skilio-brand)] shadow-[var(--skilio-shadow-1)]">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-[var(--skilio-ink)]">Have something new to add?</div>
              <p className="mt-0.5 text-sm text-[var(--skilio-ink-soft)]">
                Add one piece of evidence and we’ll tag the skills for you.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setShowAddOptions((current) => !current)}
            aria-expanded={showAddOptions}
            className="shrink-0 gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
          >
            <UploadCloud className="h-4 w-4" />
            Add new evidence
          </Button>
        </div>
      ) : (
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDragging(false);
            }
          }}
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setIsDragging(false);
            chooseFile(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "rounded-[var(--skilio-radius-lg)] border border-dashed p-6 text-center transition-colors sm:p-8",
            isDragging
              ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)]"
              : "border-[var(--skilio-border-strong)] bg-[var(--skilio-control)]",
          )}
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-elevated)] text-[var(--skilio-brand)] shadow-[var(--skilio-shadow-1)]">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div className="mt-3 font-semibold text-[var(--skilio-ink)]">
            Drop one piece of evidence here
          </div>
          <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-[var(--skilio-ink-soft)]">
            PDF, DOCX, image, portfolio link, or MP4. Supported documents and links are analyzed automatically; images and video can be tagged manually.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" onClick={() => documentInputRef.current?.click()} className="gap-2">
              <Paperclip className="h-4 w-4" /> Upload file
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowLinkInput((current) => !current)} className="gap-2">
              <Link2 className="h-4 w-4" /> Paste a link
            </Button>
            <Button type="button" variant="outline" onClick={() => videoInputRef.current?.click()} className="gap-2">
              <Video className="h-4 w-4" /> Upload video
            </Button>
          </div>
        </div>
      )}

      {isPortfolioApplicant && showAddOptions && (
        <div className="-mt-3 flex flex-wrap gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] px-4 pb-4">
          <Button type="button" variant="outline" onClick={() => documentInputRef.current?.click()} className="gap-2">
            <Paperclip className="h-4 w-4" /> Upload file
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowLinkInput((current) => !current)} className="gap-2">
            <Link2 className="h-4 w-4" /> Paste a link
          </Button>
          <Button type="button" variant="outline" onClick={() => videoInputRef.current?.click()} className="gap-2">
            <Video className="h-4 w-4" /> Upload video
          </Button>
        </div>
      )}

      <input
        ref={documentInputRef}
        type="file"
        aria-label="Upload an evidence file"
        tabIndex={-1}
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
        className="sr-only"
        onChange={(event) => {
          chooseFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        aria-label="Upload a video as evidence"
        tabIndex={-1}
        accept=".mp4,video/mp4"
        className="sr-only"
        onChange={(event) => {
          chooseFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      {showLinkInput && (
        <div className="flex flex-col gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] p-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="application-evidence-link" className="sr-only">
              Portfolio or case-study link
            </label>
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--skilio-ink-muted)]" />
            <Input
              id="application-evidence-link"
              autoFocus
              value={linkValue}
              onChange={(event) => setLinkValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitLink();
                }
              }}
              placeholder="portfolio.example.com/case-study"
              className="pl-9"
            />
          </div>
          <Button type="button" onClick={submitLink} disabled={!linkValue.trim()} className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
            Analyze link
          </Button>
        </div>
      )}

      {isPortfolioApplicant && exactMatches.length > 0 && (
        <section aria-labelledby="exact-matches-heading">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 id="exact-matches-heading" className="text-base font-semibold text-[var(--skilio-ink)]">
              Exact matches from your portfolio
            </h3>
            <span className="text-xs text-[var(--skilio-ink-muted)]">Already selected — review before continuing</span>
          </div>
          <div className="divide-y divide-[var(--skilio-border)] border-y border-[var(--skilio-border)]">
            {exactMatches.map((jobSkill) => {
              const active = selectedSet.has(normalizeSkill(jobSkill.name));
              return (
                <div key={jobSkill.id} className="py-4 first:pt-3 last:pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[var(--skilio-ink)]">{jobSkill.name}</span>
                        <Badge className="rounded-md bg-[var(--skilio-control-strong)] text-xs font-semibold text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control-strong)]">
                          Exact match
                        </Badge>
                      </div>
                      {editingSkill === jobSkill.name ? (
                        <Textarea
                          autoFocus
                          value={skillEvidence[jobSkill.name] ?? ""}
                          onChange={(event) =>
                            setSkillEvidence((current) => ({
                              ...current,
                              [jobSkill.name]: event.target.value,
                            }))
                          }
                          onBlur={() => setEditingSkill(null)}
                          className="mt-2 min-h-20"
                          placeholder={`Add a short example of where you used ${jobSkill.name}.`}
                        />
                      ) : (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                          {skillEvidence[jobSkill.name] || "Matched from your Skilio portfolio."}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" onClick={() => setEditingSkill(jobSkill.name)} className="min-h-10 px-2 text-sm font-medium text-[var(--skilio-brand-strong)] hover:underline">
                        Edit
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        aria-label={`${active ? "Remove" : "Add"} ${jobSkill.name}`}
                        onClick={() => toggleSelectedSkill(jobSkill.name)}
                        className={cn(
                          "relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)] focus-visible:ring-offset-2",
                          active ? "bg-[var(--skilio-brand)]" : "bg-[var(--skilio-border-strong)]",
                        )}
                      >
                        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform", active ? "translate-x-0 left-6" : "left-1")} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isPortfolioApplicant && relatedMatches.length > 0 && (
        <section aria-labelledby="related-matches-heading">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 id="related-matches-heading" className="text-base font-semibold text-[var(--skilio-ink)]">
              Related to this role
            </h3>
            <span className="text-xs text-[var(--skilio-ink-muted)]">
              Portfolio skills in the same Skilio category — off by default
            </span>
          </div>
          <div className="divide-y divide-[var(--skilio-border)] border-y border-[var(--skilio-border)]">
            {relatedMatches.map(({ skill, relatedTo }) => {
              const active = selectedSet.has(normalizeSkill(skill));
              return (
                <div key={skill} className="flex items-start justify-between gap-4 py-4 first:pt-3 last:pb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--skilio-ink)]">{skill}</span>
                      <Badge variant="outline" className="rounded-md border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] text-xs font-semibold text-[var(--skilio-ink-soft)]">
                        Related to {relatedTo}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                      {skillEvidence[skill] || "Available from your Skilio portfolio."}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-label={`${active ? "Remove" : "Add"} ${skill}`}
                    onClick={() => toggleSelectedSkill(skill)}
                    className={cn(
                      "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)] focus-visible:ring-offset-2",
                      active ? "bg-[var(--skilio-brand)]" : "bg-[var(--skilio-border-strong)]",
                    )}
                  >
                    <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform", active ? "left-6" : "left-1")} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isPortfolioApplicant && requestedSkills.length > 0 && (
        <section aria-labelledby="requested-skills-heading">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 id="requested-skills-heading" className="text-base font-semibold text-[var(--skilio-ink)]">Other skills requested for this role</h3>
            <span className="text-xs text-[var(--skilio-ink-muted)]">Off by default — add only if they apply to you</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {requestedSkills.map((skill) => {
              const active = selectedSet.has(normalizeSkill(skill.name));
              return (
                <button
                  key={skill.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSelectedSkill(skill.name)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-[var(--skilio-radius-sm)] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)] focus-visible:ring-offset-2",
                    active
                      ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]"
                      : "border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control)]",
                  )}
                >
                  {active ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {skill.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isPortfolioApplicant && allOtherPortfolioSkills.length > 0 && (
        <div className="rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)]">
          <button
            type="button"
            onClick={() => setShowMorePortfolio((current) => !current)}
            aria-expanded={showMorePortfolio}
            className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-[var(--skilio-ink)]">More skills from your portfolio ({allOtherPortfolioSkills.length})</span>
              <span className="mt-0.5 block text-xs leading-5 text-[var(--skilio-ink-muted)]">Browse anything else you want to include</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", showMorePortfolio && "rotate-180")} />
          </button>
          {showMorePortfolio && (
            <div className="border-t border-[var(--skilio-border)] p-4">
              <label htmlFor="portfolio-skill-search" className="sr-only">
                Search your portfolio skills
              </label>
              <Input id="portfolio-skill-search" value={portfolioQuery} onChange={(event) => setPortfolioQuery(event.target.value)} placeholder="Search your portfolio skills" />
              <div className="mt-3 flex flex-wrap gap-2">
                {otherPortfolioSkills.map((skill) => {
                  const active = selectedSet.has(normalizeSkill(skill));
                  return (
                    <button key={skill} type="button" onClick={() => toggleSelectedSkill(skill)} className={cn("min-h-9 rounded-[var(--skilio-radius-sm)] border px-3 text-sm font-medium", active ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]" : "border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)]")}>
                      {active ? "✓" : "+"} {skill}
                    </button>
                  );
                })}
                {otherPortfolioSkills.length === 0 && (
                  <p className="text-sm text-[var(--skilio-ink-soft)]">
                    No portfolio skills match “{portfolioQuery.trim()}”.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {artifacts.length > 0 && (
        <section aria-labelledby="uploads-heading">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 id="uploads-heading" className="text-base font-semibold text-[var(--skilio-ink)]">Your evidence</h3>
            <span className="text-xs text-[var(--skilio-ink-muted)]">Only confirmed evidence is shared</span>
          </div>
          <div className="space-y-3">
            {artifacts.map((artifact) => {
              const Icon = sourceIcon(artifact.kind);
              return (
                <article key={artifact.id} className={cn("rounded-[var(--skilio-radius-lg)] border p-4", artifact.status === "confirmed" ? "border-[var(--skilio-brand)] bg-[var(--skilio-elevated)]" : "border-[var(--skilio-border)] bg-[var(--skilio-control)]")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-elevated)] text-[var(--skilio-brand)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--skilio-ink)]">{artifact.name}</div>
                        <div className="mt-0.5 text-xs text-[var(--skilio-ink-muted)]">{sourceDescription(artifact)}</div>
                      </div>
                    </div>
                    <Badge className={cn("shrink-0 rounded-md text-xs font-semibold", artifact.status === "confirmed" ? "bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]" : artifact.status === "error" ? "bg-[var(--skilio-danger-soft)] text-[var(--skilio-danger)]" : "bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)]")}>
                      {statusLabel(artifact.status)}
                    </Badge>
                  </div>

                  {artifact.status === "processing" ? (
                    <div className="mt-4 overflow-hidden rounded-[var(--skilio-radius-md)] bg-[var(--skilio-elevated)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand)]">
                          <Sparkles className="h-4 w-4" />
                          <span className="absolute inset-0 rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-brand)] motion-safe:animate-ping motion-reduce:hidden" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-[var(--skilio-ink)]">{processingCopy?.[0]}</div>
                          <div className="mt-0.5 text-xs text-[var(--skilio-ink-muted)]">{processingCopy?.[1]}</div>
                        </div>
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--skilio-brand)] motion-reduce:animate-none" />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden="true">
                        {[0, 1, 2].map((stage) => (
                          <span key={stage} className={cn("h-1 rounded-full transition-colors", stage <= processingStage ? "bg-[var(--skilio-brand)]" : "bg-[var(--skilio-border-strong)]")} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {artifact.summary && (
                        <p className="mt-3 rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control)] px-3 py-2 text-sm leading-6 text-[var(--skilio-ink-soft)]">{artifact.summary}</p>
                      )}
                      {artifact.error && (
                        <p role="alert" className="mt-3 text-sm leading-6 text-[var(--skilio-danger)]">{artifact.error}</p>
                      )}
                      {artifact.skillNames.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {artifact.skillNames.map((skill) => (
                            <span key={skill} className="rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-brand)] bg-[var(--skilio-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--skilio-brand-strong)]">{skill}</span>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => openReview(artifact)} className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
                          {artifact.status === "confirmed" ? "Edit review" : artifact.status === "manual" ? "Add skills" : "Review and confirm"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => removeArtifact(artifact)}>
                          Remove
                        </Button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <div className="rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)]">
        <button type="button" onClick={() => setShowManual((current) => !current)} aria-expanded={showManual} className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[var(--skilio-ink)]">
          Prefer to add a skill yourself?
          <ChevronDown className={cn("h-4 w-4 transition-transform", showManual && "rotate-180")} />
        </button>
        {showManual && (
          <div className="border-t border-[var(--skilio-border)] p-4">
            {!isPortfolioApplicant && jobSkills.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {jobSkills.map((skill) => {
                  const active = selectedSet.has(normalizeSkill(skill.name));
                  return (
                    <button key={skill.id} type="button" onClick={() => toggleSelectedSkill(skill.name)} className={cn("min-h-9 rounded-[var(--skilio-radius-sm)] border px-3 text-sm font-medium", active ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]" : "border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)]")}>
                      {active ? "✓" : "+"} {skill.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="manual-application-skill" className="sr-only">
                Add another skill manually
              </label>
              <Input id="manual-application-skill" value={manualSkill} onChange={(event) => setManualSkill(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addManualSkill(); } }} placeholder="Type another skill" />
              <Button type="button" variant="outline" onClick={addManualSkill} disabled={!manualSkill.trim()} className="gap-2">
                <Plus className="h-4 w-4" /> Add skill
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] px-4 py-3 text-sm leading-6 text-[var(--skilio-ink-soft)]">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--skilio-brand)]" />
        <p>
          Only skills and write-ups you confirm are shared with the employer. You can continue without adding evidence.
          {willCreatePortfolio
            ? " Your confirmed skills will also seed the new Skilio profile you chose to create."
            : ""}
        </p>
      </div>

      <Dialog
        open={Boolean(activeArtifact)}
        onOpenChange={(open) => {
          if (!open) setActiveArtifactId(null);
        }}
      >
        <DialogContent className="skilio-interface max-h-[90vh] max-w-xl overflow-y-auto rounded-[var(--skilio-radius-lg)] border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-5 shadow-[var(--skilio-shadow-2)] sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl text-[var(--skilio-ink)]">
              {activeArtifact?.suggestedSkills.length ? "Confirm the skills in this evidence" : "Add skills for this evidence"}
            </DialogTitle>
            <DialogDescription className="leading-6 text-[var(--skilio-ink-soft)]">
              Review every suggestion, add anything we missed, and edit the write-up before saving.
            </DialogDescription>
          </DialogHeader>

          {activeArtifact && (
            <div className="flex items-center gap-3 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] px-3 py-2.5 text-sm font-medium text-[var(--skilio-ink)]">
              {(() => {
                const Icon = sourceIcon(activeArtifact.kind);
                return <Icon className="h-4 w-4 shrink-0 text-[var(--skilio-brand)]" />;
              })()}
              <span className="truncate">{activeArtifact.name}</span>
            </div>
          )}

          <div>
            <div className="text-sm font-semibold text-[var(--skilio-ink)]">Suggested skills</div>
            {modalSkills.length > 0 ? (
              <div className="mt-2 space-y-2">
                {modalSkills.map((skill) => {
                  const selected = modalSelected.some(
                    (item) => normalizeSkill(item) === normalizeSkill(skill.name),
                  );
                  return (
                    <button
                      key={skill.id || skill.name}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleModalSkill(skill.name)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--skilio-radius-sm)] border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)] focus-visible:ring-offset-2",
                        selected
                          ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)]"
                          : "border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)]",
                      )}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-[var(--skilio-ink)]">{skill.name}</span>
                        {skill.categoryName && <span className="mt-0.5 block text-xs text-[var(--skilio-ink-muted)]">{skill.categoryName}</span>}
                      </span>
                      <span className={cn("flex h-7 w-7 items-center justify-center rounded-[var(--skilio-radius-sm)] border", selected ? "border-[var(--skilio-brand)] bg-[var(--skilio-brand)] text-white" : "border-[var(--skilio-border-strong)] text-[var(--skilio-ink-muted)]")}>
                        {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control)] px-3 py-2 text-sm text-[var(--skilio-ink-soft)]">
                No automatic suggestions yet. Search below to add the skills this evidence demonstrates.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="application-skill-search" className="text-sm font-semibold text-[var(--skilio-ink)]">Not seeing the right skill?</label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--skilio-ink-muted)]" />
              <Input id="application-skill-search" value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Search the Skilio skill catalogue" className="pl-9 pr-9" />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--skilio-brand)]" />}
            </div>
            {searchError && <p role="alert" className="mt-1 text-xs text-[var(--skilio-danger)]">{searchError}</p>}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-44 overflow-y-auto rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-1">
                {searchResults.map((skill) => (
                  <button key={skill.id || skill.name} type="button" onClick={() => addSearchSkill(skill)} className="flex min-h-10 w-full items-center justify-between rounded-[var(--skilio-radius-sm)] px-3 py-2 text-left text-sm font-medium text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]">
                    {skill.name}<Plus className="h-4 w-4 text-[var(--skilio-brand)]" />
                  </button>
                ))}
              </div>
            )}
            {skillQuery.trim().length >= 2 &&
              !searchResults.some(
                (skill) =>
                  normalizeSkill(skill.name) === normalizeSkill(skillQuery),
              ) && (
                <button
                  type="button"
                  onClick={() =>
                    addSearchSkill({
                      id: `custom-${normalizeSkill(skillQuery)}`,
                      name: skillQuery.trim(),
                      type: null,
                      description: null,
                      categoryId: null,
                      categoryName: "Custom skill",
                      subcategoryId: null,
                      subcategoryName: null,
                      apiVersion: "custom",
                    })
                  }
                  className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-[var(--skilio-radius-sm)] border border-dashed border-[var(--skilio-border-strong)] px-3 py-2 text-left text-sm font-medium text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
                >
                  <Plus className="h-4 w-4 text-[var(--skilio-brand)]" />
                  Use “{skillQuery.trim()}” as a custom skill
                </button>
              )}
          </div>

          <div>
            <label htmlFor="application-evidence-summary" className="text-sm font-semibold text-[var(--skilio-ink)]">Suggested write-up</label>
            <p className="mt-0.5 text-xs leading-5 text-[var(--skilio-ink-muted)]">Make sure this accurately describes your work. You stay in control of what is shared.</p>
            <Textarea id="application-evidence-summary" value={summaryDraft} onChange={(event) => setSummaryDraft(event.target.value)} className="mt-2 min-h-28" placeholder="Briefly explain what this evidence shows and how you used these skills." />
          </div>

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => setActiveArtifactId(null)}>Cancel</Button>
            <Button type="button" onClick={saveReview} disabled={modalSelected.length === 0} className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
              Save confirmed skills
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
