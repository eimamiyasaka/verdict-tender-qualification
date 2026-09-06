import Link from "next/link";
import { Card, EmptyState } from "@/components/common/layout";
import {
  DateMono,
  SectionLabel,
  VerdictWord,
} from "@/components/common/typography";
import {
  RerunButton,
  RerunMessage,
  RerunProvider,
} from "@/components/tender/rerun-form";
import { CompactResultRow, ResultRow } from "@/components/tender/result-row";
import { pluralise } from "@/lib/format";
import type {
  AssessmentResult,
  RequirementWithSources,
  TenderDetail,
} from "@/lib/types";

interface Row {
  requirement: RequirementWithSources;
  result: AssessmentResult;
}

/**
 * The demo screen (§10.2, §12.4, §12.5). It has to land in ten seconds:
 * verdict block, then BLOCKING, then NEEDS AN ANSWER FROM YOU, then two
 * collapsed disclosures. Verdicts and counts are read from the Assessment,
 * never recomputed here.
 */
export function AssessmentTab({
  detail,
  closed,
}: {
  detail: TenderDetail;
  closed: boolean;
}) {
  const { tender, latestAssessment } = detail;

  if (!latestAssessment) {
    const hasRequirements = detail.requirements.length > 0;
    const stillExtracting = detail.documents.some(
      (d) =>
        d.extractionStatus === "pending" || d.extractionStatus === "running",
    );
    return (
      <RerunProvider tenderId={tender.id}>
        <EmptyState
          title={
            hasRequirements
              ? "This tender hasn't been assessed yet."
              : "No requirements to assess yet."
          }
          body={
            hasRequirements
              ? `${pluralise(detail.requirements.length, "requirement")} extracted. Run the assessment to check them against your profile.`
              : stillExtracting
                ? "Requirements are still being extracted from the pack. The assessment can run once that finishes."
                : "Upload the pack on the Documents tab. Verdict extracts every requirement with a page citation, then checks them against your profile."
          }
          action={
            hasRequirements ? (
              <div className="flex flex-col items-center gap-2">
                <RerunButton
                  label="Run assessment"
                  size="default"
                  disabled={closed}
                />
                <RerunMessage />
              </div>
            ) : (
              <Link
                href={`/tenders/${tender.id}?tab=documents`}
                className="text-sm text-ink underline underline-offset-4"
              >
                Go to Documents
              </Link>
            )
          }
        />
      </RerunProvider>
    );
  }

  const byRequirement = new Map(detail.requirements.map((r) => [r.id, r]));
  const rows: Row[] = latestAssessment.results
    .map((result) => {
      const requirement = byRequirement.get(result.requirementId);
      return requirement ? { requirement, result } : null;
    })
    .filter((r): r is Row => r !== null);

  const blocking = rows.filter(
    (r) =>
      r.requirement.obligation === "mandatory" && r.result.verdict === "fail",
  );
  const unknowns = rows.filter(
    (r) =>
      r.requirement.obligation === "mandatory" &&
      r.result.verdict === "unknown",
  );
  const met = rows.filter(
    (r) =>
      r.requirement.obligation === "mandatory" && r.result.verdict === "pass",
  );
  const desirable = rows.filter(
    (r) => r.requirement.obligation === "desirable",
  );
  const verdictOrder = {
    fail: 0,
    unknown: 1,
    pass: 2,
    not_applicable: 3,
  } as const;
  desirable.sort(
    (a, b) => verdictOrder[a.result.verdict] - verdictOrder[b.result.verdict],
  );
  met.sort((a, b) => (a.result.warning ? 0 : 1) - (b.result.warning ? 0 : 1));

  const a = latestAssessment;
  const staleSinceRun =
    a.version < Math.max(...detail.assessmentVersions.map((v) => v.version));

  return (
    <RerunProvider tenderId={tender.id}>
      <div className="flex flex-col gap-8">
        {detail.profileChangedSinceAssessment && !closed ? (
          <div className="flex flex-col gap-3 rounded-sm border border-rule px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink">
              Your profile changed after version {a.version} was run. The
              verdict below is what was true then.
            </p>
            <RerunButton label="Re-run assessment" />
          </div>
        ) : null}
        {closed ? (
          <p className="rounded-sm border border-rule px-4 py-3 text-sm text-ink/80">
            The submission deadline has passed. This tender is read-only; the
            assessment stays as it was.
          </p>
        ) : null}

        {/* Verdict block (§12.4) */}
        <section
          aria-label="Verdict"
          className="grid min-h-[140px] grid-cols-1 gap-x-10 gap-y-5 rounded-sm bg-ink px-6 py-7 text-paper sm:grid-cols-[auto_1fr] sm:items-center sm:px-8 sm:py-8"
        >
          <VerdictWord
            recommendation={a.recommendation}
            onInk
            className="text-[36px] leading-none sm:text-[44px]"
          />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-base leading-snug text-paper sm:text-[17px]">
              {a.rationale}
            </p>
            <p className="tabular text-sm text-paper/75">
              {a.mandatoryPassed} pass{" "}
              <span aria-hidden className="font-mono text-paper/40">
                ·
              </span>{" "}
              {a.mandatoryFailed} fail{" "}
              <span aria-hidden className="font-mono text-paper/40">
                ·
              </span>{" "}
              {a.mandatoryUnknown} unknown{" "}
              <span aria-hidden className="font-mono text-paper/40">
                ·
              </span>{" "}
              {desirable.length} desirable
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-paper/75">
              <span className="tabular">
                Assessed v{a.version}{" "}
                <span aria-hidden className="font-mono text-paper/40">
                  ·
                </span>{" "}
                <DateMono date={a.createdAt} className="text-paper/75" />
                {a.runById && !staleSinceRun ? null : null}
              </span>
              {a.deadlineUsed ? (
                <span className="tabular">
                  against deadline{" "}
                  <DateMono date={a.deadlineUsed} className="text-paper/75" />
                </span>
              ) : (
                <span>no deadline recorded — expiry checks used today</span>
              )}
              {!closed ? <RerunButton label="Re-run" onInk /> : null}
              <RerunMessage onInk className="basis-full" />
            </div>
          </div>
        </section>

        {/* 1. BLOCKING */}
        {blocking.length > 0 ? (
          <section aria-labelledby="blocking" className="flex flex-col gap-3">
            <SectionLabel id="blocking" tone="flag">
              Blocking
            </SectionLabel>
            <Card>
              <ul className="divide-y divide-rule">
                {blocking.map((r) => (
                  <ResultRow
                    key={r.result.id}
                    requirement={r.requirement}
                    result={r.result}
                  />
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        {/* 2. NEEDS AN ANSWER FROM YOU */}
        {unknowns.length > 0 ? (
          <section aria-labelledby="unknowns" className="flex flex-col gap-3">
            <SectionLabel id="unknowns" tone="pending">
              Needs an answer from you
            </SectionLabel>
            <Card>
              <ul className="divide-y divide-rule">
                {unknowns.map((r) => (
                  <ResultRow
                    key={r.result.id}
                    requirement={r.requirement}
                    result={r.result}
                  />
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        {blocking.length === 0 && unknowns.length === 0 ? (
          <p className="text-sm text-ink/80">
            Every mandatory requirement is provably met by your profile. The
            desirable criteria below affect scoring, not eligibility.
          </p>
        ) : null}

        {/* 3. Collapsed disclosures */}
        <div className="flex flex-col gap-3">
          <Disclosure
            summary={`${pluralise(met.length, "requirement")} met`}
            count={met.length}
          >
            {met.map((r) => (
              <CompactResultRow
                key={r.result.id}
                requirement={r.requirement}
                result={r.result}
              />
            ))}
          </Disclosure>
          <Disclosure
            summary={`${pluralise(desirable.length, "desirable criterion", "desirable criteria")}`}
            count={desirable.length}
            detail={
              a.desirableScore !== null
                ? `${desirable.filter((d) => d.result.verdict === "pass").length} met · ${a.desirableScore}% coverage`
                : undefined
            }
          >
            {desirable.map((r) => (
              <CompactResultRow
                key={r.result.id}
                requirement={r.requirement}
                result={r.result}
              />
            ))}
          </Disclosure>
        </div>
      </div>
    </RerunProvider>
  );
}

function Disclosure({
  summary,
  detail,
  count,
  children,
}: {
  summary: string;
  detail?: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) {
    return (
      <p className="px-1 text-sm text-ink/50">
        <span
          aria-hidden
          className="mr-2 inline-block w-3 text-center font-mono"
        >
          ·
        </span>
        {summary}
      </p>
    );
  }
  return (
    <details className="group rounded-sm border border-rule open:bg-paper">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-ink hover:bg-rule/30 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-block w-3 text-center font-mono text-ink/60 transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        <span>{summary}</span>
        {detail ? (
          <span className="tabular font-mono text-[12px] text-ink/60">
            {detail}
          </span>
        ) : null}
      </summary>
      <ul className="divide-y divide-rule border-t border-rule">{children}</ul>
    </details>
  );
}
