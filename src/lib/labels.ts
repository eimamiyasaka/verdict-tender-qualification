/**
 * Display labels for enum values. Domain vocabulary is exact (§5): tender,
 * pack, PSQ, ITT, requirement, mandatory, method statement.
 */
import type {
  BidRecommendation,
  DocumentType,
  ExtractionStatus,
  FinancialMetric,
  InsuranceType,
  KeyDateKind,
  Obligation,
  RequirementKind,
  TaskStatus,
  TenderSource,
  TenderStatus,
  Verdict,
} from "./types";
import { humanise } from "./format";

export const RECOMMENDATION_LABEL: Record<BidRecommendation, string> = {
  bid: "Bid",
  no_bid: "No bid",
  review: "Review",
};

/** The verdict word as it appears on cards and the verdict block: BID · NO BID · REVIEW */
export const RECOMMENDATION_WORD: Record<BidRecommendation, string> = {
  bid: "BID",
  no_bid: "NO BID",
  review: "REVIEW",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  pass: "Pass",
  fail: "Fail",
  unknown: "Unknown",
  not_applicable: "Not applicable",
};

export const OBLIGATION_LABEL: Record<Obligation, string> = {
  mandatory: "Mandatory",
  desirable: "Desirable",
  informational: "Informational",
};

export const REQUIREMENT_KIND_LABEL: Record<RequirementKind, string> = {
  certification: "Certification",
  financial: "Financial",
  insurance: "Insurance",
  experience: "Experience",
  policy: "Policy",
  legal_status: "Legal status",
  resource: "Resource",
  question: "Question",
  date: "Date",
  other: "Other",
};

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  contract_notice: "Contract notice",
  specification: "Specification",
  psq: "PSQ",
  itt: "ITT",
  pricing_schedule: "Pricing schedule",
  terms_and_conditions: "Terms and conditions",
  evaluation_methodology: "Evaluation methodology",
  clarification_log: "Clarification log",
  other: "Other",
};

export const EXTRACTION_STATUS_LABEL: Record<ExtractionStatus, string> = {
  pending: "Pending",
  running: "Extracting",
  complete: "Complete",
  failed: "Failed",
};

export const TENDER_STATUS_LABEL: Record<TenderStatus, string> = {
  draft: "Draft",
  extracting: "Extracting",
  extraction_failed: "Extraction failed",
  extracted: "Extracted",
  assessed: "Assessed",
  bidding: "Bidding",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
  abandoned: "Abandoned",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  in_review: "In review",
  complete: "Complete",
};

export const FINANCIAL_METRIC_LABEL: Record<FinancialMetric, string> = {
  annual_turnover: "Annual turnover",
  net_assets: "Net assets",
  profit_before_tax: "Profit before tax",
  current_ratio: "Current ratio",
  credit_score: "Credit score",
};

export const INSURANCE_TYPE_LABEL: Record<InsuranceType, string> = {
  employers_liability: "Employers' liability",
  public_liability: "Public liability",
  professional_indemnity: "Professional indemnity",
  product_liability: "Product liability",
  cyber: "Cyber",
  contract_works: "Contract works",
  motor_fleet: "Motor fleet",
};

export const KEY_DATE_KIND_LABEL: Record<KeyDateKind, string> = {
  clarification_deadline: "Clarification deadline",
  submission_deadline: "Submission deadline",
  site_visit: "Site visit",
  presentation: "Presentation",
  award_notification: "Award notification",
  contract_start: "Contract start",
  contract_end: "Contract end",
};

export const POLICY_TYPE_LABEL: Record<string, string> = {
  modern_slavery: "Modern slavery",
  equality: "Equality, diversity and inclusion",
  environmental: "Environmental",
  health_safety: "Health and safety",
  data_protection: "Data protection",
};

export const TENDER_SOURCE_LABEL: Record<TenderSource, string> = {
  find_a_tender: "Find a Tender",
  contracts_finder: "Contracts Finder",
  manual: "Manual",
};

export const SECTOR_LABEL: Record<string, string> = {
  healthcare: "Healthcare",
  local_government: "Local government",
  education: "Education",
  housing: "Housing",
  central_government: "Central government",
  commercial: "Commercial",
  transport: "Transport",
};

export function policyTypeLabel(type: string): string {
  return POLICY_TYPE_LABEL[type] ?? humanise(type);
}

export function sectorLabel(sector: string | null): string {
  if (!sector) return "—";
  return SECTOR_LABEL[sector] ?? humanise(sector);
}

export const EVENT_ACTION_LABEL: Record<string, string> = {
  "tender.created": "Tender created",
  "tender.status_changed": "Status changed",
  "document.uploaded": "Document uploaded",
  "extraction.completed": "Extraction completed",
  "extraction.failed": "Extraction failed",
  "assessment.run": "Assessment run",
  "result.overridden": "Result overridden",
  "profile.updated": "Profile updated",
  "task.updated": "Task updated",
  "response.saved": "Response saved",
  "library.answer_used": "Library answer used",
};
