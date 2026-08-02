"use client";

import { Check, ChevronsUpDown, Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc/client";

export type CatalogueSkill = {
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

type SkillCataloguePickerProps = {
  excludedNames?: string[];
  onSelect: (skill: CatalogueSkill) => void;
  onAddCustom: (name: string) => void;
};

export function SkillCataloguePicker({
  excludedNames = [],
  onSelect,
  onAddCustom,
}: SkillCataloguePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [query]);

  const search = trpc.job.searchSkills.useQuery(
    { query: debouncedQuery, limit: 10 },
    {
      enabled: open && debouncedQuery.length >= 2,
      retry: false,
      staleTime: 5 * 60_000,
    },
  );
  const excluded = useMemo(
    () => new Set(excludedNames.map((name) => name.trim().toLowerCase())),
    [excludedNames],
  );
  const results = (search.data ?? []).filter(
    (skill) => !excluded.has(skill.name.trim().toLowerCase()),
  );
  const canAddCustom =
    query.trim().length >= 2 && !excluded.has(query.trim().toLowerCase());

  function finish() {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="mt-2 h-10 w-full justify-between border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] px-3 font-normal text-[var(--skilio-ink-soft)] shadow-none hover:bg-[var(--skilio-control)] hover:text-[var(--skilio-ink)]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-[var(--skilio-brand)]" />
            <span className="truncate">Search the skill catalogue</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--skilio-ink-muted)]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="skilio-interface w-[var(--radix-popover-trigger-width)] border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-0 shadow-[var(--skilio-shadow-2)]"
      >
        <Command
          shouldFilter={false}
          className="bg-[var(--skilio-elevated)] [&_[cmdk-input-wrapper]]:border-[var(--skilio-border)] [&_[cmdk-input-wrapper]]:bg-[var(--skilio-control)] [&_[cmdk-input-wrapper]]:text-[var(--skilio-ink-muted)] [&_[cmdk-input-wrapper]:focus-within]:border-[var(--skilio-brand)] [&_[cmdk-input-wrapper]_svg]:text-[var(--skilio-ink-muted)] [&_[cmdk-input-wrapper]_svg]:opacity-100 [&_[cmdk-input]]:!border-0 [&_[cmdk-input]]:!bg-transparent [&_[cmdk-input]]:!shadow-none [&_[cmdk-input]]:!outline-none [&_[cmdk-input]]:text-[var(--skilio-ink)] [&_[cmdk-input]]:placeholder:text-[var(--skilio-ink-muted)]"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Type at least 2 characters..."
            aria-label="Search skills"
          />
          <CommandList className="max-h-80">
            {query.trim().length < 2 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--skilio-ink-muted)]">
                Search by a skill name, tool, or capability.
              </div>
            ) : search.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-[var(--skilio-ink-soft)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching the catalogue
              </div>
            ) : search.isError ? (
              <div className="px-4 py-5 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                The catalogue is unavailable. Add this as a custom skill below.
              </div>
            ) : (
              <>
                <CommandEmpty>No catalogue matches found.</CommandEmpty>
                {results.length > 0 && (
                  <CommandGroup heading="Skill catalogue">
                    {results.map((skill) => (
                      <CommandItem
                        key={skill.id}
                        value={skill.id}
                        onSelect={() => {
                          onSelect(skill);
                          finish();
                        }}
                        className="items-start rounded-[var(--skilio-radius-sm)] px-3 py-3 data-[selected=true]:bg-[var(--skilio-control)]"
                      >
                        <Check className="mt-0.5 h-4 w-4 text-[var(--skilio-brand)]" />
                        <span className="min-w-0">
                          <span className="block font-medium text-[var(--skilio-ink)]">
                            {skill.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--skilio-ink-muted)]">
                            {[skill.type, skill.categoryName]
                              .filter(Boolean)
                              .join(" / ") || "Canonical skill"}
                          </span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
            {canAddCustom && (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={`custom-${query}`}
                  onSelect={() => {
                    onAddCustom(query.trim());
                    finish();
                  }}
                  className="rounded-[var(--skilio-radius-sm)] px-3 py-3 data-[selected=true]:bg-[var(--skilio-control)]"
                >
                  <Plus className="h-4 w-4 text-[var(--skilio-brand)]" />
                  <span>
                    Add <span className="font-medium">&ldquo;{query.trim()}&rdquo;</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
