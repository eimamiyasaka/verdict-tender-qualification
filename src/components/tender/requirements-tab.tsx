"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SourceLink, ViewSourceButton } from "@/components/tender/citation-drawer";
import { Chip, VerdictMark } from "@/components/common/typography";
import { Input } from "@/components/ui/input";
import { OBLIGATION_LABEL, REQUIREMENT_KIND_LABEL, VERDICT_LABEL } from "@/lib/labels";
import {
  OBLIGATIONS,
  REQUIREMENT_KINDS,
  VERDICTS,
  type AssessmentResult,
  type Obligation,
  type RequirementKind,
  type RequirementWithSources,
  type Verdict,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const VERDICT_ORDER: Record<Verdict, number> = { fail: 0, unknown: 1, pass: 2, not_applicable: 3 };
const OBLIGATION_ORDER: Record<Obligation, number> = { mandatory: 0, desirable: 1, informational: 2 };

type SortMode = "verdict" | "source";

/**
 * The full matrix (§10.2): filterable by kind, obligation and verdict; default
 * sort fail → unknown → pass. Filters live in the URL so a filtered view can
 * be shared, and are applied client-side so they are instant.
 */
export function RequirementsTab({
  requirements,
  results,
  assessed,
}: {
  requirements: RequirementWithSources[];
  results: Record<string, AssessmentResult>;
  assessed: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const kind = (params.get("kind") ?? "") as RequirementKind | "";
  const obligation = (params.get("obligation") ?? "") as Obligation | "";
  const verdict = (params.get("verdict") ?? "") as Verdict | "";
  const sort = (params.get("sort") === "source" ? "source" : "verdict") as SortMode;
  const [query, setQuery] = React.useState(params.get("q") ?? "");

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("tab", "requirements");
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;
    const t = setTimeout(() => setParam("q", query), 250);
    return () => clearTimeout(t);
  }, [query, params, setParam]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = requirements.filter((r) => {
      if (kind && r.kind !== kind) return false;
      if (obligation && r.obligation !== obligation) return false;
      const v = results[r.id]?.verdict;
      if (verdict && v !== verdict) return false;
      if (q) {
        const hay = `${r.summary} ${r.quotedClause} ${r.clauseReference ?? ""} ${r.document.filename} ${r.questionRef ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      if (sort === "source") {
        return a.document.filename.localeCompare(b.document.filename) || a.pageNumber - b.pageNumber;
      }
      const va = results[a.id]?.verdict ?? "not_applicable";
      const vb = results[b.id]?.verdict ?? "not_applicable";
      return (
        VERDICT_ORDER[va] - VERDICT_ORDER[vb] ||
        OBLIGATION_ORDER[a.obligation] - OBLIGATION_ORDER[b.obligation] ||
        a.document.filename.localeCompare(b.document.filename) ||
        a.pageNumber - b.pageNumber
      );
    });
    return rows;
  }, [requirements, results, kind, obligation, verdict, query, sort]);

  const anyFilter = Boolean(kind || obligation || verdict || query);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-[12px] text-ink/60">
            Search
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="summary, clause, document…" className="h-8 text-[13px]" />
          </label>
          <FilterSelect label="Kind" value={kind} onChange={(v) => setParam("kind", v)} options={REQUIREMENT_KINDS.map((k) => [k, REQUIREMENT_KIND_LABEL[k]])} />
          <FilterSelect label="Obligation" value={obligation} onChange={(v) => setParam("obligation", v)} options={OBLIGATIONS.map((o) => [o, OBLIGATION_LABEL[o]])} />
          <FilterSelect
            label="Verdict"
            value={verdict}
            onChange={(v) => setParam("verdict", v)}
            options={VERDICTS.map((v) => [v, VERDICT_LABEL[v]])}
            disabled={!assessed}
          />
        </div>
        <div className="flex items-center gap-3 text-[12px] text-ink/60">
          <span className="tabular">
            {filtered.length} of {requirements.length}
          </span>
          <span aria-hidden className="font-mono text-ink/40">·</span>
          <label className="flex items-center gap-1.5">
            Sort
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value === "verdict" ? "" : e.target.value)}
              className="h-7 rounded-sm border border-rule bg-paper px-1.5 text-[12px] text-ink"
            >
              <option value="verdict">verdict</option>
              <option value="source">source</option>
            </select>
          </label>
          {anyFilter ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                router.replace(`${pathname}?tab=requirements`, { scroll: false });
              }}
              className="rounded-sm font-mono text-ink/60 underline-offset-4 hover:text-ink hover:underline"
            >
              clear
            </button>
          ) : null}
        </div>
      </div>

      {!assessed ? (
        <p className="text-[13px] text-ink/60">Not assessed yet — the verdict column fills in after the first assessment run.</p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-8 text-center text-sm text-ink/70">
          {requirements.length === 0
            ? "No requirements yet. Upload the pack on the Documents tab."
            : "No requirements match these filters. Clear them to see all of them again."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[11px] tracking-wide text-ink/60 uppercase">
                <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">
                  Verdict
                </th>
                <th scope="col" className="w-[42%] px-3 py-2.5 font-medium sm:px-4">
                  Requirement
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">
                  Obligation
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">
                  Source
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">
                  Kind
                </th>
                <th scope="col" className="px-3 py-2.5 sm:px-4">
                  <span className="sr-only">View clause</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {filtered.map((r) => {
                const result = results[r.id];
                return (
                  <tr key={r.id} className="align-top hover:bg-rule/20">
                    <td className="px-3 py-3 whitespace-nowrap sm:px-4">
                      {result ? <VerdictMark verdict={result.verdict} /> : <span className="font-mono text-[12px] text-ink/40">—</span>}
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      <p className={cn("text-ink", r.obligation === "mandatory" && "font-medium")}>{r.summary}</p>
                      {result && (result.verdict === "fail" || result.verdict === "unknown") ? (
                        <p className="mt-0.5 text-[13px] text-ink/70">{result.rationale}</p>
                      ) : null}
                      {r.questionRef ? (
                        <p className="mt-1 flex flex-wrap gap-1.5">
                          <Chip>{r.questionRef}</Chip>
                          {r.wordLimit ? <Chip>{r.wordLimit.toLocaleString("en-GB")} words</Chip> : null}
                          {r.weighting !== null ? <Chip>{r.weighting}%</Chip> : null}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink/80 sm:px-4">{OBLIGATION_LABEL[r.obligation]}</td>
                    <td className="px-3 py-3 whitespace-nowrap sm:px-4">
                      <SourceLink requirement={r} />
                      {r.citations.length > 0 ? <span className="ml-1.5 font-mono text-[11px] text-ink/50">+{r.citations.length}</span> : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink/80 sm:px-4">{REQUIREMENT_KIND_LABEL[r.kind]}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap sm:px-4">
                      <ViewSourceButton requirement={r} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ink/60">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 rounded-sm border border-rule bg-paper px-2 text-[13px] text-ink hover:border-ink/60 focus:border-ink disabled:opacity-50"
      >
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
