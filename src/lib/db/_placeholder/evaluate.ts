/**
 * PLACEHOLDER EVALUATOR — delete when `src/lib/qualify/evaluate.ts` lands.
 *
 * The real qualification engine is pure TypeScript on the server branch, with
 * its signature frozen in contracts.ts and its behaviour unit-tested. This
 * stub follows the per-kind rules in spec §9 closely enough that the seeded
 * assessments are consistent with the seeded profile and the "add a policy,
 * re-run, unknown becomes pass, verdict stays no-bid" demo path works against
 * placeholder data. Nothing under src/app or src/components imports it.
 *
 * It exists so the frontend can be exercised end to end, not to be merged.
 */
import { fiscalYearLabel, formatDate, formatMoney, monthsBetween } from "@/lib/format";
import { INSURANCE_TYPE_LABEL, policyTypeLabel } from "@/lib/labels";
import type {
  Assessment,
  AssessmentResult,
  BidRecommendation,
  Credential,
  CredentialType,
  EvidenceRef,
  FinancialYear,
  Insurance,
  Organisation,
  PastProject,
  Policy,
  Requirement,
  RequirementConstraint,
  Verdict,
} from "@/lib/types";

export interface ProfileSnapshot {
  organisation: Organisation;
  credentials: Credential[];
  credentialTypes: CredentialType[];
  financialYears: FinancialYear[];
  insurances: Insurance[];
  pastProjects: PastProject[];
  policies: Policy[];
}

export interface Evaluation {
  verdict: Verdict;
  rationale: string;
  evidence: EvidenceRef[];
  warning: string | null;
}

interface Clock {
  asOf: Date;
  deadline: Date | null;
}

const DAY_MS = 86_400_000;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function credentialLabel(code: string, types: CredentialType[]): string {
  return types.find((t) => t.code === code)?.label ?? code;
}

// ---------------------------------------------------------------------------

function evaluateCertification(
  constraint: Extract<RequirementConstraint, { kind: "certification" }>,
  profile: ProfileSnapshot,
  clock: Clock,
): Evaluation {
  const label = credentialLabel(constraint.credential_code, profile.credentialTypes);
  const known = profile.credentialTypes.some((t) => t.code === constraint.credential_code);
  if (!known) {
    return {
      verdict: "unknown",
      rationale: `Credential code "${constraint.credential_code}" is not one Verdict recognises. Check the clause and add the certification to your profile by hand.`,
      evidence: [],
      warning: null,
    };
  }
  const held = profile.credentials.find((c) => c.code === constraint.credential_code);
  if (!held) {
    return {
      verdict: "fail",
      rationale: "Not held. No certificate on your profile.",
      evidence: [],
      warning: null,
    };
  }
  const evidence: EvidenceRef[] = [
    { table: "credentials", id: held.id, label, note: held.reference ?? undefined, matched: true },
  ];
  const ref = held.reference ? ` (${held.reference})` : "";
  if (!held.expiresOn) {
    return { verdict: "pass", rationale: `${label} held${ref} — does not expire.`, evidence, warning: null };
  }
  const deadline = clock.deadline ?? clock.asOf;
  if (held.expiresOn.getTime() < deadline.getTime()) {
    return {
      verdict: "fail",
      rationale: `${label} expired ${formatDate(held.expiresOn)} — before the submission deadline of ${formatDate(deadline)}.`,
      evidence,
      warning: null,
    };
  }
  const daysAfter = daysBetween(deadline, held.expiresOn);
  if (daysAfter <= 30) {
    return {
      verdict: "pass",
      rationale: `${label} held${ref}, valid to ${formatDate(held.expiresOn)}.`,
      evidence,
      warning: `Certificate expires ${formatDate(held.expiresOn)}, ${daysAfter} ${daysAfter === 1 ? "day" : "days"} after the submission deadline. Renew before contract start.`,
    };
  }
  return {
    verdict: "pass",
    rationale: `${label} held${ref}, valid to ${formatDate(held.expiresOn)}.`,
    evidence,
    warning: null,
  };
}

// ---------------------------------------------------------------------------

const METRIC_WORD: Record<string, string> = {
  annual_turnover: "turnover",
  net_assets: "net assets",
  profit_before_tax: "profit before tax",
  current_ratio: "current ratio",
  credit_score: "credit score",
};

function metricValue(year: FinancialYear, metric: string): number | null | undefined {
  switch (metric) {
    case "annual_turnover":
      return year.turnover;
    case "net_assets":
      return year.netAssets;
    case "profit_before_tax":
      return year.profitBeforeTax;
    default:
      return undefined;
  }
}

function compare(actual: number, operator: string, target: number): boolean {
  switch (operator) {
    case "gte":
      return actual >= target;
    case "gt":
      return actual > target;
    case "lte":
      return actual <= target;
    case "lt":
      return actual < target;
    case "eq":
      return actual === target;
    default:
      return false;
  }
}

function evaluateFinancial(
  constraint: Extract<RequirementConstraint, { kind: "financial" }>,
  profile: ProfileSnapshot,
): Evaluation {
  const word = METRIC_WORD[constraint.metric] ?? constraint.metric;
  const years = [...profile.financialYears].sort((a, b) => b.yearEnding.getTime() - a.yearEnding.getTime());
  const needed = Math.max(1, constraint.years ?? 1);
  const currency = (constraint.currency ?? "GBP").toUpperCase();

  if (constraint.metric === "current_ratio" || constraint.metric === "credit_score") {
    return {
      verdict: "unknown",
      rationale: `${word.charAt(0).toUpperCase() + word.slice(1)} is not recorded on your profile, so this cannot be decided.`,
      evidence: [],
      warning: null,
    };
  }
  if (years.length < needed) {
    return {
      verdict: "unknown",
      rationale: `Only ${years.length} financial ${years.length === 1 ? "year" : "years"} entered; ${needed} required to decide.`,
      evidence: years.map((y) => ({ table: "financial_years", id: y.id, label: fiscalYearLabel(y.yearEnding) })),
      warning: null,
    };
  }
  const window = years.slice(0, needed);
  const evidence: EvidenceRef[] = [];
  for (const year of window) {
    const value = metricValue(year, constraint.metric);
    const fy = fiscalYearLabel(year.yearEnding);
    if (value === null || value === undefined) {
      return {
        verdict: "unknown",
        rationale: `${fy} ${word} not entered. ${describeOthers(window, year, constraint, word)}`.trim(),
        evidence: window.map((y) => ({
          table: "financial_years",
          id: y.id,
          label: fiscalYearLabel(y.yearEnding),
          matched: y.id !== year.id,
        })),
        warning: null,
      };
    }
    if (year.currency.toUpperCase() !== currency) {
      return {
        verdict: "unknown",
        rationale: `The requirement is stated in ${currency} but ${fy} is recorded in ${year.currency.toUpperCase()}. Verdict does not convert currencies at an invented rate — enter the figure in ${currency} to decide.`,
        evidence: [{ table: "financial_years", id: year.id, label: fy }],
        warning: null,
      };
    }
    const ok = compare(value, constraint.operator, constraint.value);
    evidence.push({
      table: "financial_years",
      id: year.id,
      label: `${fy} ${word} ${formatMoney(value, currency)}`,
      matched: ok,
    });
    if (!ok) {
      const gap = Math.abs(constraint.value - value);
      const gapText =
        constraint.operator === "gte" || constraint.operator === "gt"
          ? `short by ${formatMoney(gap, currency)}`
          : `over by ${formatMoney(gap, currency)}`;
      return {
        verdict: "fail",
        rationale: `${fy} ${word} ${formatMoney(value, currency)} — ${gapText}.`,
        evidence,
        warning: null,
      };
    }
  }
  if (window.length === 1) {
    const year = window[0];
    const value = metricValue(year, constraint.metric) as number;
    const margin = value - constraint.value;
    const tail =
      constraint.operator === "gt" && constraint.value === 0
        ? "positive"
        : `exceeds ${formatMoney(constraint.value, currency)} by ${formatMoney(margin, currency)}`;
    return {
      verdict: "pass",
      rationale: `${fiscalYearLabel(year.yearEnding)} ${word} ${formatMoney(value, currency)} — ${tail}.`,
      evidence,
      warning: null,
    };
  }
  const parts = window.map(
    (y) => `${fiscalYearLabel(y.yearEnding)} ${formatMoney(metricValue(y, constraint.metric) as number, currency)}`,
  );
  const tail =
    constraint.operator === "gt" && constraint.value === 0
      ? "all positive"
      : `all clear ${formatMoney(constraint.value, currency)}`;
  return {
    verdict: "pass",
    rationale: `${capitalise(word)}: ${joinList(parts)} — ${tail}.`,
    evidence,
    warning: null,
  };
}

function describeOthers(
  window: FinancialYear[],
  missing: FinancialYear,
  constraint: Extract<RequirementConstraint, { kind: "financial" }>,
  word: string,
): string {
  const others = window.filter((y) => y.id !== missing.id && metricValue(y, constraint.metric) != null);
  if (others.length === 0) return "";
  const parts = others.map(
    (y) => `${fiscalYearLabel(y.yearEnding)} ${formatMoney(metricValue(y, constraint.metric) as number, constraint.currency)}`,
  );
  const allOk = others.every((y) =>
    compare(metricValue(y, constraint.metric) as number, constraint.operator, constraint.value),
  );
  return `${joinList(parts)} ${others.length === 1 ? "clears" : "both clear"} the ${formatMoney(constraint.value, constraint.currency)} ${word} threshold${allOk ? "" : " — not all years do"}.`;
}

// ---------------------------------------------------------------------------

function evaluateInsurance(
  constraint: Extract<RequirementConstraint, { kind: "insurance" }>,
  profile: ProfileSnapshot,
  clock: Clock,
): Evaluation {
  const label = INSURANCE_TYPE_LABEL[constraint.insurance_kind] ?? constraint.insurance_kind;
  const currency = (constraint.currency ?? "GBP").toUpperCase();
  const policy = profile.insurances.find((i) => i.kind === constraint.insurance_kind);
  if (!policy) {
    return {
      verdict: "unknown",
      rationale: `No ${label.toLowerCase()} policy recorded. Add one to resolve.`,
      evidence: [],
      warning: null,
    };
  }
  const evidence: EvidenceRef[] = [
    {
      table: "insurances",
      id: policy.id,
      label: `${label} ${formatMoney(policy.coverAmount, policy.currency)}`,
      note: policy.insurer ?? undefined,
      matched: true,
    },
  ];
  if (policy.currency.toUpperCase() !== currency) {
    return {
      verdict: "unknown",
      rationale: `The requirement is stated in ${currency} but your ${label.toLowerCase()} cover is recorded in ${policy.currency.toUpperCase()}. Verdict does not convert currencies — record the cover in ${currency} to decide.`,
      evidence,
      warning: null,
    };
  }
  const deadline = clock.deadline ?? clock.asOf;
  if (policy.expiresOn && policy.expiresOn.getTime() < deadline.getTime()) {
    return {
      verdict: "fail",
      rationale: `${label} ${formatMoney(policy.coverAmount, currency)} recorded but expired ${formatDate(policy.expiresOn)}, before the submission deadline of ${formatDate(deadline)}.`,
      evidence: [{ ...evidence[0], matched: false }],
      warning: null,
    };
  }
  if (policy.coverAmount < constraint.min_cover) {
    return {
      verdict: "fail",
      rationale: `${label} ${formatMoney(policy.coverAmount, currency)} recorded — short of ${formatMoney(constraint.min_cover, currency)} by ${formatMoney(constraint.min_cover - policy.coverAmount, currency)}.`,
      evidence: [{ ...evidence[0], matched: false }],
      warning: null,
    };
  }
  const insurer = policy.insurer ? ` (${policy.insurer})` : "";
  const validity = policy.expiresOn ? `, valid to ${formatDate(policy.expiresOn)}` : "";
  const meets =
    policy.coverAmount === constraint.min_cover
      ? `meets ${formatMoney(constraint.min_cover, currency)}`
      : `exceeds ${formatMoney(constraint.min_cover, currency)} by ${formatMoney(policy.coverAmount - constraint.min_cover, currency)}`;
  let warning: string | null = null;
  if (policy.expiresOn) {
    const daysAfter = daysBetween(deadline, policy.expiresOn);
    if (daysAfter <= 30) {
      warning = `Policy expires ${formatDate(policy.expiresOn)}, ${daysAfter} ${daysAfter === 1 ? "day" : "days"} after the submission deadline. Renew before contract start.`;
    }
  }
  return {
    verdict: "pass",
    rationale: `${label} ${formatMoney(policy.coverAmount, currency)} recorded${insurer} — ${meets}${validity}.`,
    evidence,
    warning,
  };
}

// ---------------------------------------------------------------------------

function evaluateExperience(
  constraint: Extract<RequirementConstraint, { kind: "experience" }> & { referee_contactable?: boolean },
  profile: ProfileSnapshot,
  clock: Clock,
): Evaluation {
  const cutoff = constraint.within_years
    ? new Date(clock.asOf.getFullYear() - constraint.within_years, clock.asOf.getMonth(), clock.asOf.getDate())
    : null;
  const evidence: EvidenceRef[] = [];
  const matched: PastProject[] = [];
  for (const project of profile.pastProjects) {
    const reasons: string[] = [];
    if (constraint.min_value !== undefined) {
      if (project.contractValue === null) reasons.push("no contract value recorded");
      else if (project.contractValue < constraint.min_value)
        reasons.push(`${formatMoney(project.contractValue, project.currency)} is under ${formatMoney(constraint.min_value, constraint.currency)}`);
    }
    if (cutoff) {
      const ended = project.endedOn ?? clock.asOf;
      if (ended.getTime() < cutoff.getTime()) reasons.push(`ended ${formatDate(project.endedOn)}, outside the last ${constraint.within_years} years`);
    }
    if (constraint.sector && project.sector !== constraint.sector) reasons.push(`sector is ${project.sector ?? "not recorded"}`);
    if (constraint.public_sector_only && !project.isPublicSector) reasons.push("not public sector");
    if (constraint.referee_contactable && !project.refereeContactable) reasons.push("referee not contactable");
    const ok = reasons.length === 0;
    if (ok) matched.push(project);
    evidence.push({
      table: "past_projects",
      id: project.id,
      label: `${project.clientName} — ${project.title}${project.contractValue !== null ? ` (${formatMoney(project.contractValue, project.currency)})` : ""}`,
      note: ok ? undefined : reasons.join("; "),
      matched: ok,
    });
  }
  const criteria: string[] = [];
  if (constraint.min_value !== undefined) criteria.push(`≥ ${formatMoney(constraint.min_value, constraint.currency)}`);
  if (constraint.sector) criteria.push(`${constraint.sector.replace(/_/g, " ")} sector`);
  if (constraint.public_sector_only) criteria.push("public sector");
  if (constraint.referee_contactable) criteria.push("contactable referee");
  if (constraint.within_years) criteria.push(`within ${constraint.within_years} years`);
  const criteriaText = criteria.length ? ` matching ${criteria.join(", ")}` : "";
  const noun = matched.length === 1 ? "project" : "projects";
  if (matched.length >= constraint.min_count) {
    return {
      verdict: "pass",
      rationale: `${matched.length} ${noun}${criteriaText} — ${constraint.min_count} required.`,
      evidence,
      warning: null,
    };
  }
  return {
    verdict: "fail",
    rationale: `${matched.length} ${noun}${criteriaText} — ${constraint.min_count} required, short by ${constraint.min_count - matched.length}.`,
    evidence,
    warning: null,
  };
}

// ---------------------------------------------------------------------------

function evaluatePolicy(
  constraint: Extract<RequirementConstraint, { kind: "policy" }>,
  profile: ProfileSnapshot,
  clock: Clock,
): Evaluation {
  const label = policyTypeLabel(constraint.policy_type);
  const policy = profile.policies.find((p) => p.policyType === constraint.policy_type);
  if (!policy) {
    return {
      verdict: "fail",
      rationale: `No ${label.toLowerCase()} policy on your profile.`,
      evidence: [],
      warning: null,
    };
  }
  const evidence: EvidenceRef[] = [
    { table: "policies", id: policy.id, label: policy.title ?? `${label} policy`, matched: true },
  ];
  if (!policy.lastReviewed) {
    return {
      verdict: "pass",
      rationale: `${label} policy held — review date not recorded.`,
      evidence,
      warning: null,
    };
  }
  const months = monthsBetween(policy.lastReviewed, clock.asOf);
  return {
    verdict: "pass",
    rationale: `${label} policy held — last reviewed ${formatDate(policy.lastReviewed)}.`,
    evidence,
    warning:
      months > 24
        ? `Last reviewed ${months} months ago. Buyers commonly expect a review within 24 months.`
        : null,
  };
}

// ---------------------------------------------------------------------------

export function evaluateRequirement(req: Requirement, profile: ProfileSnapshot, clock: Clock): Evaluation {
  const c = req.constraintJson;
  switch (req.kind) {
    case "certification":
      return evaluateCertification(c as Extract<RequirementConstraint, { kind: "certification" }>, profile, clock);
    case "financial":
      return evaluateFinancial(c as Extract<RequirementConstraint, { kind: "financial" }>, profile);
    case "insurance":
      return evaluateInsurance(c as Extract<RequirementConstraint, { kind: "insurance" }>, profile, clock);
    case "experience":
      return evaluateExperience(c as Extract<RequirementConstraint, { kind: "experience" }>, profile, clock);
    case "policy":
      return evaluatePolicy(c as Extract<RequirementConstraint, { kind: "policy" }>, profile, clock);
    case "question":
      return {
        verdict: "not_applicable",
        rationale: `Not an eligibility gate. ${req.questionRef ?? "This question"} is answered in the workspace${req.wordLimit ? ` (${req.wordLimit.toLocaleString("en-GB")} words)` : ""}.`,
        evidence: [],
        warning: null,
      };
    case "date":
      return {
        verdict: "not_applicable",
        rationale: "A key date, not an eligibility gate. Shown in the tender header.",
        evidence: [],
        warning: null,
      };
    case "other":
      if (typeof (c as Record<string, unknown>).credential_code === "string") {
        return {
          verdict: "unknown",
          rationale: `Credential code "${(c as Record<string, unknown>).credential_code}" is not one Verdict recognises. Check the clause and add the certification to your profile by hand.`,
          evidence: [],
          warning: null,
        };
      }
      return {
        verdict: "not_applicable",
        rationale: "Informational. Not evaluated against the profile.",
        evidence: [],
        warning: null,
      };
    default:
      return {
        verdict: "not_applicable",
        rationale: "Not an eligibility gate. Not evaluated against the profile.",
        evidence: [],
        warning: null,
      };
  }
}

/** §9: any mandatory fail → no_bid; any mandatory unknown → review; otherwise bid. */
export function recommend(
  rows: Array<{ obligation: Requirement["obligation"]; verdict: Verdict }>,
): BidRecommendation {
  const mandatory = rows.filter((r) => r.obligation === "mandatory");
  if (mandatory.some((r) => r.verdict === "fail")) return "no_bid";
  if (mandatory.some((r) => r.verdict === "unknown")) return "review";
  return "bid";
}

export interface BuildAssessmentInput {
  id?: string;
  tenderId: string;
  orgId: string;
  version: number;
  requirements: Requirement[];
  profile: ProfileSnapshot;
  asOf: Date;
  deadline: Date | null;
  runById: string | null;
  createdAt?: Date;
  newId: () => string;
}

export function buildAssessment(input: BuildAssessmentInput): {
  assessment: Assessment;
  results: AssessmentResult[];
} {
  const assessmentId = input.id ?? input.newId();
  const createdAt = input.createdAt ?? input.asOf;
  const clock = { asOf: input.asOf, deadline: input.deadline };
  const results: AssessmentResult[] = input.requirements.map((req) => {
    const ev = evaluateRequirement(req, input.profile, clock);
    return {
      id: input.newId(),
      assessmentId,
      requirementId: req.id,
      orgId: input.orgId,
      verdict: ev.verdict,
      rationale: ev.rationale,
      evidence: ev.evidence,
      warning: ev.warning,
      overriddenById: null,
      overrideNote: null,
      createdAt,
    };
  });
  const byId = new Map(input.requirements.map((r) => [r.id, r]));
  const rows = results.map((r) => ({ obligation: byId.get(r.requirementId)!.obligation, verdict: r.verdict }));
  const mandatory = rows.filter((r) => r.obligation === "mandatory" && r.verdict !== "not_applicable");
  const desirable = rows.filter((r) => r.obligation === "desirable" && r.verdict !== "not_applicable");
  const passed = mandatory.filter((r) => r.verdict === "pass").length;
  const failed = mandatory.filter((r) => r.verdict === "fail").length;
  const unknown = mandatory.filter((r) => r.verdict === "unknown").length;
  const desirablePassed = desirable.filter((r) => r.verdict === "pass").length;
  const recommendation = recommend(rows);

  const rationale =
    recommendation === "no_bid"
      ? `${failed} mandatory ${failed === 1 ? "failure blocks" : "failures block"} this tender.`
      : recommendation === "review"
        ? `${unknown} ${unknown === 1 ? "unknown needs" : "unknowns need"} an answer before this can be called.`
        : "All mandatory gates clear.";

  const assessment: Assessment = {
    id: assessmentId,
    tenderId: input.tenderId,
    orgId: input.orgId,
    version: input.version,
    recommendation,
    mandatoryTotal: mandatory.length,
    mandatoryPassed: passed,
    mandatoryFailed: failed,
    mandatoryUnknown: unknown,
    desirableScore: desirable.length ? Math.round((desirablePassed / desirable.length) * 100) : null,
    rationale,
    deadlineUsed: input.deadline,
    asOfUsed: input.asOf,
    runById: input.runById,
    createdAt,
  };
  return { assessment, results };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
