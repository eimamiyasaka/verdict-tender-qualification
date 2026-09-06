/**
 * PLACEHOLDER SEED — the §13 demo organisation and three tenders.
 *
 * Every figure here is a placeholder. The server branch owns the real
 * `prisma/seed.ts` and the committed packs under public/packs; this file
 * exists so the frontend renders a loaded product without a database.
 *
 * Deadlines are relative to "now" so the pipeline always shows the intended
 * drama: one tender closing inside a week, one inside three.
 */
import type {
  Assessment,
  AssessmentResult,
  BidTask,
  Credential,
  CredentialType,
  DocumentType,
  Event,
  FinancialYear,
  Insurance,
  KeyDate,
  LibraryAnswer,
  Membership,
  Obligation,
  Organisation,
  PastProject,
  Policy,
  Requirement,
  RequirementCitation,
  RequirementConstraint,
  RequirementKind,
  Response,
  Tender,
  TenderDocument,
  User,
} from "@/lib/types";
import { buildAssessment, type ProfileSnapshot } from "./evaluate";
import type { Store } from "./store";

// ---------------------------------------------------------------------------
// Clock helpers
// ---------------------------------------------------------------------------

const NOW = new Date();

function daysFromNow(days: number, hour = 12): Date {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, hour, 0, 0, 0);
  return d;
}

function monthsAgo(months: number, day = 10): Date {
  return new Date(NOW.getFullYear(), NOW.getMonth() - months, day);
}

function on(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

let idCounter = 0;
function id(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${String(idCounter).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const DEMO_ORG_ID = "org-meridian";
export const DEMO_USER_ID = "user-priya";

const organisation: Organisation = {
  id: DEMO_ORG_ID,
  name: "Meridian Facilities Ltd",
  companiesHouseNumber: "08127734",
  headcount: 62,
  registeredRegion: "England",
  sicCodes: ["81210", "81299", "81300"],
  createdAt: monthsAgo(14),
};

const users: User[] = [
  {
    id: DEMO_USER_ID,
    email: process.env.DEMO_EMAIL ?? "demo@meridianfacilities.co.uk",
    displayName: "Priya Shah",
    createdAt: monthsAgo(14),
  },
  { id: "user-tom", email: "tom.okafor@meridianfacilities.co.uk", displayName: "Tom Okafor", createdAt: monthsAgo(11) },
  { id: "user-hannah", email: "hannah.reid@meridianfacilities.co.uk", displayName: "Hannah Reid", createdAt: monthsAgo(9) },
];

const memberships: Membership[] = [
  { id: id("mem"), orgId: DEMO_ORG_ID, userId: DEMO_USER_ID, role: "owner", createdAt: monthsAgo(14) },
  { id: id("mem"), orgId: DEMO_ORG_ID, userId: "user-tom", role: "member", createdAt: monthsAgo(11) },
  { id: id("mem"), orgId: DEMO_ORG_ID, userId: "user-hannah", role: "admin", createdAt: monthsAgo(9) },
];

// ---------------------------------------------------------------------------
// Reference data (§7.4) — exactly the twelve seed rows
// ---------------------------------------------------------------------------

const credentialTypes: CredentialType[] = [
  { code: "ISO9001", label: "ISO 9001 Quality Management", category: "quality" },
  { code: "ISO14001", label: "ISO 14001 Environmental Management", category: "environmental" },
  { code: "ISO27001", label: "ISO 27001 Information Security", category: "security" },
  { code: "ISO45001", label: "ISO 45001 Occupational H&S", category: "hs" },
  { code: "CYBER_ESSENTIALS", label: "Cyber Essentials", category: "security" },
  { code: "CYBER_ESSENTIALS_PLUS", label: "Cyber Essentials Plus", category: "security" },
  { code: "CHAS", label: "CHAS Accreditation", category: "hs" },
  { code: "SAFECONTRACTOR", label: "SafeContractor", category: "hs" },
  { code: "CONSTRUCTIONLINE", label: "Constructionline", category: "quality" },
  { code: "SSIP", label: "SSIP Member Scheme", category: "hs" },
  { code: "DSPT", label: "NHS Data Security & Protection Toolkit", category: "security" },
  { code: "BS_EN_1276", label: "BS EN 1276", category: "quality" },
];

// ---------------------------------------------------------------------------
// Supplier profile (§13) — holds ISO 9001, ISO 14001, CHAS, Cyber Essentials.
// Does not hold ISO 27001. No employers' liability recorded.
// ---------------------------------------------------------------------------

const credentials: Credential[] = [
  {
    id: "cred-iso9001",
    orgId: DEMO_ORG_ID,
    code: "ISO9001",
    reference: "MF-Q-2291",
    issuedOn: on(2024, 5, 10),
    expiresOn: on(2027, 5, 9),
    evidenceUrl: null,
    createdAt: monthsAgo(14),
  },
  {
    id: "cred-iso14001",
    orgId: DEMO_ORG_ID,
    code: "ISO14001",
    reference: "MF-E-2292",
    issuedOn: on(2024, 5, 10),
    expiresOn: on(2027, 5, 9),
    evidenceUrl: null,
    createdAt: monthsAgo(14),
  },
  {
    id: "cred-chas",
    orgId: DEMO_ORG_ID,
    code: "CHAS",
    reference: "CHAS-441870",
    issuedOn: daysFromNow(-295),
    expiresOn: daysFromNow(70),
    evidenceUrl: null,
    createdAt: monthsAgo(9),
  },
  {
    id: "cred-ce",
    orgId: DEMO_ORG_ID,
    code: "CYBER_ESSENTIALS",
    reference: "IASME-CE-77120",
    issuedOn: daysFromNow(-340),
    expiresOn: daysFromNow(25),
    evidenceUrl: null,
    createdAt: monthsAgo(11),
  },
];

const financialYears: FinancialYear[] = [
  {
    id: "fy-2025",
    orgId: DEMO_ORG_ID,
    yearEnding: on(2025, 3, 31),
    turnover: 4_120_000,
    netAssets: 1_240_000,
    profitBeforeTax: 312_000,
    currency: "GBP",
    createdAt: monthsAgo(4),
  },
  {
    id: "fy-2024",
    orgId: DEMO_ORG_ID,
    yearEnding: on(2024, 3, 31),
    turnover: 3_870_000,
    netAssets: 1_090_000,
    profitBeforeTax: 268_000,
    currency: "GBP",
    createdAt: monthsAgo(14),
  },
  {
    id: "fy-2023",
    orgId: DEMO_ORG_ID,
    yearEnding: on(2023, 3, 31),
    turnover: 3_410_000,
    netAssets: null,
    profitBeforeTax: 201_000,
    currency: "GBP",
    createdAt: monthsAgo(14),
  },
];

const insurances: Insurance[] = [
  {
    id: "ins-pl",
    orgId: DEMO_ORG_ID,
    kind: "public_liability",
    coverAmount: 10_000_000,
    currency: "GBP",
    insurer: "Aviva",
    expiresOn: on(2027, 3, 31),
    createdAt: monthsAgo(6),
  },
  {
    id: "ins-pi",
    orgId: DEMO_ORG_ID,
    kind: "professional_indemnity",
    coverAmount: 5_000_000,
    currency: "GBP",
    insurer: "Hiscox",
    expiresOn: on(2027, 3, 31),
    createdAt: monthsAgo(6),
  },
];

const pastProjects: PastProject[] = [
  {
    id: "proj-mft",
    orgId: DEMO_ORG_ID,
    clientName: "Manchester University NHS Foundation Trust",
    title: "Cleaning services, Wythenshawe Hospital outpatients",
    description: "Daily and periodic cleaning across 14 outpatient departments to National Standards of Healthcare Cleanliness 2021.",
    contractValue: 1_400_000,
    currency: "GBP",
    sector: "healthcare",
    startedOn: on(2022, 4, 1),
    endedOn: on(2025, 3, 31),
    isPublicSector: true,
    refereeContactable: true,
    createdAt: monthsAgo(13),
  },
  {
    id: "proj-salford",
    orgId: DEMO_ORG_ID,
    clientName: "Salford City Council",
    title: "Grounds maintenance, north district parks",
    description: "Grass cutting, hedge and shrub maintenance, litter and play-area inspection across 31 sites.",
    contractValue: 620_000,
    currency: "GBP",
    sector: "local_government",
    startedOn: on(2021, 9, 1),
    endedOn: null,
    isPublicSector: true,
    refereeContactable: true,
    createdAt: monthsAgo(13),
  },
  {
    id: "proj-trafford",
    orgId: DEMO_ORG_ID,
    clientName: "Trafford College Group",
    title: "Soft FM bundle, three campuses",
    description: "Cleaning, waste, pest control and grounds for the Altrincham, Stretford and Stockport campuses.",
    contractValue: 480_000,
    currency: "GBP",
    sector: "education",
    startedOn: on(2023, 1, 9),
    endedOn: on(2025, 12, 31),
    isPublicSector: true,
    refereeContactable: true,
    createdAt: monthsAgo(13),
  },
  {
    id: "proj-bolton",
    orgId: DEMO_ORG_ID,
    clientName: "Bolton at Home",
    title: "Communal-area cleaning, 42 blocks",
    description: null,
    contractValue: 390_000,
    currency: "GBP",
    sector: "housing",
    startedOn: on(2022, 6, 1),
    endedOn: on(2024, 5, 31),
    isPublicSector: true,
    refereeContactable: false,
    createdAt: monthsAgo(13),
  },
  {
    id: "proj-stockport",
    orgId: DEMO_ORG_ID,
    clientName: "Stockport Metropolitan Borough Council",
    title: "Winter gritting and grounds, town centre",
    description: null,
    contractValue: 210_000,
    currency: "GBP",
    sector: "local_government",
    startedOn: on(2023, 10, 1),
    endedOn: on(2025, 3, 31),
    isPublicSector: true,
    refereeContactable: true,
    createdAt: monthsAgo(13),
  },
  {
    id: "proj-gmp",
    orgId: DEMO_ORG_ID,
    clientName: "Greater Manchester Police",
    title: "Estate cleaning, four divisional stations",
    description: null,
    contractValue: 860_000,
    currency: "GBP",
    sector: "central_government",
    startedOn: on(2020, 1, 6),
    endedOn: on(2023, 1, 5),
    isPublicSector: true,
    refereeContactable: true,
    createdAt: monthsAgo(13),
  },
  {
    id: "proj-coop",
    orgId: DEMO_ORG_ID,
    clientName: "Co-op Group",
    title: "Office cleaning, 1 Angel Square",
    description: "Daytime and evening cleaning of a 330,000 sq ft headquarters, 38 FTE on site.",
    contractValue: 1_100_000,
    currency: "GBP",
    sector: "commercial",
    startedOn: on(2021, 3, 1),
    endedOn: null,
    isPublicSector: false,
    refereeContactable: true,
    createdAt: monthsAgo(13),
  },
  {
    id: "proj-bruntwood",
    orgId: DEMO_ORG_ID,
    clientName: "Bruntwood SciTech",
    title: "Multi-site FM, Manchester Science Park",
    description: null,
    contractValue: 540_000,
    currency: "GBP",
    sector: "commercial",
    startedOn: on(2022, 2, 1),
    endedOn: on(2024, 1, 31),
    isPublicSector: false,
    refereeContactable: true,
    createdAt: monthsAgo(13),
  },
  {
    id: "proj-kelloggs",
    orgId: DEMO_ORG_ID,
    clientName: "Kellanova (Kellogg's) Trafford Park",
    title: "Site services, Trafford Park",
    description: null,
    contractValue: 180_000,
    currency: "GBP",
    sector: "commercial",
    startedOn: on(2024, 4, 1),
    endedOn: on(2025, 3, 31),
    isPublicSector: false,
    refereeContactable: false,
    createdAt: monthsAgo(13),
  },
];

const policies: Policy[] = [
  {
    id: "pol-ms",
    orgId: DEMO_ORG_ID,
    policyType: "modern_slavery",
    title: "Modern Slavery and Human Trafficking Statement",
    lastReviewed: monthsAgo(31),
    documentUrl: null,
    createdAt: monthsAgo(31),
  },
  {
    id: "pol-eq",
    orgId: DEMO_ORG_ID,
    policyType: "equality",
    title: "Equality, Diversity and Inclusion Policy",
    lastReviewed: monthsAgo(8),
    documentUrl: null,
    createdAt: monthsAgo(20),
  },
  {
    id: "pol-env",
    orgId: DEMO_ORG_ID,
    policyType: "environmental",
    title: "Environmental Policy",
    lastReviewed: monthsAgo(5),
    documentUrl: null,
    createdAt: monthsAgo(20),
  },
  {
    id: "pol-hs",
    orgId: DEMO_ORG_ID,
    policyType: "health_safety",
    title: "Health and Safety Policy Statement",
    lastReviewed: monthsAgo(2),
    documentUrl: null,
    createdAt: monthsAgo(20),
  },
];

// ---------------------------------------------------------------------------
// Answer library (§13) — six answers
// ---------------------------------------------------------------------------

const libraryAnswers: LibraryAnswer[] = [
  {
    id: "lib-social-value",
    orgId: DEMO_ORG_ID,
    title: "Social value: local employment and apprenticeships",
    body: `Meridian recruits within a five-mile radius of every site we serve. On the Wythenshawe outpatients contract 31 of 34 operatives lived in the M22 and M23 postcodes, and 6 were recruited through the Trust's own Working Well programme for long-term unemployed residents.

We commit to one Level 2 Facilities Services apprenticeship for every £250,000 of annual contract value, delivered with Trafford College. Apprentices are paid the Real Living Wage from day one, not the apprentice minimum.

Our social value plan is measured against the National TOMs framework and reported quarterly. Each report lists the number of local hires, apprenticeship starts and completions, volunteer hours, and spend with local SMEs and VCSEs. We include the previous quarter's report in the contract review pack so the figures are checked before they are published.`,
    tags: ["social-value", "employment", "apprenticeships", "toms"],
    sourceTenderId: null,
    timesUsed: 7,
    createdAt: monthsAgo(10),
  },
  {
    id: "lib-safeguarding",
    orgId: DEMO_ORG_ID,
    title: "Safeguarding and staff vetting",
    body: `Every operative working on a site where children or vulnerable adults may be present holds an enhanced DBS certificate with barred-list check before their first shift. Certificates are re-checked every three years and monitored through the DBS Update Service in between.

Our Safeguarding Lead is the Operations Director, who holds Level 3 Designated Safeguarding Lead training. Every operative completes Level 1 safeguarding awareness during induction and annually thereafter, with a short assessment recorded in our training system.

Concerns are reported through a single route: verbally to the site supervisor and in writing on the same day using our safeguarding concern form. The supervisor escalates to the Safeguarding Lead within two hours, and the client's designated officer is informed the same working day. We never investigate a concern ourselves.`,
    tags: ["safeguarding", "dbs", "vetting", "education", "healthcare"],
    sourceTenderId: null,
    timesUsed: 4,
    createdAt: monthsAgo(9),
  },
  {
    id: "lib-tupe",
    orgId: DEMO_ORG_ID,
    title: "TUPE transfer and mobilisation",
    body: `We have received 214 employees under TUPE across eleven transfers in the last five years and have never had a claim upheld at tribunal.

Mobilisation begins with a data request to the outgoing contractor within two working days of award, using the Employee Liability Information template in the Regulations. We hold a collective consultation meeting on site within ten days, followed by individual meetings offered to every transferring employee. Each employee receives a written summary of their existing terms and a named contact.

Terms and conditions transfer intact. Where our own operatives on the same site are on better terms, we harmonise upward at the first anniversary of transfer.

A dedicated mobilisation manager is assigned from award to the end of the first quarter, with a weekly mobilisation report to the client covering staffing, equipment, training completion and any measures we propose under Regulation 13.`,
    tags: ["tupe", "mobilisation", "hr", "transfer"],
    sourceTenderId: null,
    timesUsed: 9,
    createdAt: monthsAgo(12),
  },
  {
    id: "lib-environmental",
    orgId: DEMO_ORG_ID,
    title: "Environmental management and carbon reduction",
    body: `Meridian is certified to ISO 14001:2015 across all operations. Our environmental aspects register is reviewed annually and after any change in contract scope.

On cleaning contracts we use concentrated, EU Ecolabel products dosed through wall-mounted dilution units, which cut chemical volumes by 71% on the Trafford College contract compared with the previous supplier's ready-to-use products. Microfibre systems reduce water use, and all cardboard, plastic and metal waste from consumables is segregated for recycling.

Our vehicle fleet is 40% electric and we will not buy another diesel van. Route planning software groups sites by geography so that supervisors visit each site on a fixed circuit.

We report Scope 1 and 2 emissions annually and have published a Carbon Reduction Plan in the PPN 06/21 format, targeting net zero by 2040.`,
    tags: ["environmental", "iso14001", "carbon", "ppn-06-21", "sustainability"],
    sourceTenderId: null,
    timesUsed: 6,
    createdAt: monthsAgo(8),
  },
  {
    id: "lib-quality",
    orgId: DEMO_ORG_ID,
    title: "Quality assurance and KPI monitoring",
    body: `Our quality management system is certified to ISO 9001:2015. Every site has a cleaning specification broken down into task frequencies, and every task frequency has an audit standard.

Supervisors audit 10% of areas each week using a tablet-based audit application with photographs. Client representatives can join any audit and receive the report the same day. Scores below 85% trigger a corrective action with a named owner and a re-audit within five working days.

Monthly KPI reports cover audit scores, response times for reactive requests, absence and cover rates, training completion and complaints. We hold a monthly contract review meeting with the client and a quarterly review with our Operations Director.

For NHS contracts we audit to the National Standards of Healthcare Cleanliness 2021, using the functional risk categories and audit frequencies the Standards define.`,
    tags: ["quality", "iso9001", "kpi", "audit", "monitoring"],
    sourceTenderId: null,
    timesUsed: 11,
    createdAt: monthsAgo(12),
  },
  {
    id: "lib-bc",
    orgId: DEMO_ORG_ID,
    title: "Business continuity and cover arrangements",
    body: `Our business continuity plan is reviewed every twelve months and tested annually through a desktop exercise, most recently for a severe weather scenario.

Staffing continuity is the main risk on a cleaning contract. Every site has a trained relief pool of at least 15% of headcount, drawn from operatives on neighbouring contracts who have already been inducted on the site. Absence is reported by 6am and covered by 7am, and our monthly reports record the cover rate.

Equipment and consumables are held at two-week stock levels on site, with a central store in Trafford Park that can resupply any Greater Manchester site within four hours.

In the event of a business-wide incident, the Operations Director takes the role of incident lead and the client is contacted within one hour with an assessment of any effect on service.`,
    tags: ["business-continuity", "resilience", "cover", "staffing"],
    sourceTenderId: null,
    timesUsed: 5,
    createdAt: monthsAgo(11),
  },
];

// ---------------------------------------------------------------------------
// Tender builder
// ---------------------------------------------------------------------------

interface DocSpec {
  id: string;
  filename: string;
  docType: DocumentType;
  filePath: string | null;
  pageCount: number | null;
  extractionStatus?: TenderDocument["extractionStatus"];
  extractionError?: string | null;
  /** Failed chunk count, recorded on the extraction event. */
  failedChunks?: number;
  chunkCount?: number;
}

interface ReqSpec {
  kind: RequirementKind;
  obligation?: Obligation;
  summary: string;
  constraint: Omit<RequirementConstraint, "kind"> & Record<string, unknown>;
  doc: string;
  page: number;
  clause: string | null;
  quote: string;
  questionRef?: string;
  wordLimit?: number;
  weighting?: number;
  confidence?: number;
  /** Extra citations from other documents (deduplicated obligation, §7.5). */
  also?: Array<{ doc: string; page: number; clause: string | null; quote: string }>;
}

interface TenderSpec {
  tender: Omit<Tender, "orgId" | "createdAt" | "updatedAt" | "createdById">;
  createdDaysAgo: number;
  docs: DocSpec[];
  keyDates: Array<{ kind: KeyDate["kind"]; occursAt: Date; doc?: string; page?: number; quote?: string }>;
  requirements: ReqSpec[];
}

interface BuiltTender {
  tender: Tender;
  documents: TenderDocument[];
  requirements: Requirement[];
  citations: RequirementCitation[];
  keyDates: KeyDate[];
  events: Omit<Event, "id">[];
  /** Lookup from summary to requirement id, for tasks. */
  byQuestionRef: Map<string, Requirement>;
  docById: Map<string, TenderDocument>;
}

function buildTender(spec: TenderSpec): BuiltTender {
  const createdAt = daysFromNow(-spec.createdDaysAgo, 9);
  const tender: Tender = {
    ...spec.tender,
    orgId: DEMO_ORG_ID,
    createdById: DEMO_USER_ID,
    createdAt,
    updatedAt: createdAt,
  };
  const docById = new Map<string, TenderDocument>();
  const documents: TenderDocument[] = spec.docs.map((d, i) => {
    const doc: TenderDocument = {
      id: `${spec.tender.id}-${d.id}`,
      tenderId: tender.id,
      orgId: DEMO_ORG_ID,
      filename: d.filename,
      docType: d.docType,
      filePath: d.filePath,
      pageCount: d.pageCount,
      extractionStatus: d.extractionStatus ?? "complete",
      extractionError: d.extractionError ?? null,
      uploadedAt: new Date(createdAt.getTime() + (i + 1) * 60_000),
    };
    docById.set(d.id, doc);
    return doc;
  });

  const requirements: Requirement[] = [];
  const citations: RequirementCitation[] = [];
  const byQuestionRef = new Map<string, Requirement>();
  for (const r of spec.requirements) {
    const doc = docById.get(r.doc);
    if (!doc) throw new Error(`Seed: unknown doc ${r.doc} on ${spec.tender.id}`);
    const requirement: Requirement = {
      id: id("req"),
      tenderId: tender.id,
      orgId: DEMO_ORG_ID,
      kind: r.kind,
      obligation: r.obligation ?? "mandatory",
      summary: r.summary,
      constraintJson: { kind: r.kind, ...r.constraint } as RequirementConstraint,
      documentId: doc.id,
      pageNumber: r.page,
      quotedClause: r.quote,
      clauseReference: r.clause,
      questionRef: r.questionRef ?? null,
      wordLimit: r.wordLimit ?? null,
      weighting: r.weighting ?? null,
      extractionConfidence: r.confidence ?? 0.92,
      createdAt: new Date(createdAt.getTime() + 15 * 60_000),
    };
    requirements.push(requirement);
    if (r.questionRef) byQuestionRef.set(r.questionRef, requirement);
    for (const extra of r.also ?? []) {
      const extraDoc = docById.get(extra.doc);
      if (!extraDoc) throw new Error(`Seed: unknown doc ${extra.doc}`);
      citations.push({
        id: id("cit"),
        requirementId: requirement.id,
        orgId: DEMO_ORG_ID,
        documentId: extraDoc.id,
        pageNumber: extra.page,
        quotedClause: extra.quote,
        clauseReference: extra.clause,
        createdAt: requirement.createdAt,
      });
    }
  }

  const keyDates: KeyDate[] = spec.keyDates.map((k) => ({
    id: id("kd"),
    tenderId: tender.id,
    orgId: DEMO_ORG_ID,
    kind: k.kind,
    occursAt: k.occursAt,
    documentId: k.doc ? (docById.get(k.doc)?.id ?? null) : null,
    pageNumber: k.page ?? null,
    quotedClause: k.quote ?? null,
    createdAt,
  }));

  const events: Omit<Event, "id">[] = [
    {
      orgId: DEMO_ORG_ID,
      actorId: DEMO_USER_ID,
      actorKind: "user",
      action: "tender.created",
      subjectTable: "tenders",
      subjectId: tender.id,
      payload: { tenderId: tender.id, title: tender.title, source: tender.source },
      createdAt,
    },
  ];
  documents.forEach((doc, i) => {
    events.push({
      orgId: DEMO_ORG_ID,
      actorId: DEMO_USER_ID,
      actorKind: "user",
      action: "document.uploaded",
      subjectTable: "tender_documents",
      subjectId: doc.id,
      payload: { tenderId: tender.id, filename: doc.filename, docType: doc.docType, pageCount: doc.pageCount },
      createdAt: doc.uploadedAt,
    });
    const d = spec.docs[i];
    const found = requirements.filter((r) => r.documentId === doc.id).length;
    if (doc.extractionStatus === "failed") {
      events.push({
        orgId: DEMO_ORG_ID,
        actorId: null,
        actorKind: "system",
        action: "extraction.failed",
        subjectTable: "tender_documents",
        subjectId: doc.id,
        payload: { tenderId: tender.id, filename: doc.filename, error: doc.extractionError },
        createdAt: new Date(doc.uploadedAt.getTime() + 20_000),
      });
    } else if (doc.extractionStatus === "complete") {
      const chunkCount = d.chunkCount ?? Math.max(1, Math.ceil(((doc.pageCount ?? 5) - 1) / 4));
      events.push({
        orgId: DEMO_ORG_ID,
        actorId: null,
        actorKind: "model",
        action: "extraction.completed",
        subjectTable: "tender_documents",
        subjectId: doc.id,
        payload: {
          tenderId: tender.id,
          filename: doc.filename,
          model: "claude-sonnet-4-6",
          chunkCount,
          failedChunks: d.failedChunks ?? 0,
          requirementsFound: found,
          heldForReview: found > 6 ? 2 : 0,
        },
        createdAt: new Date(doc.uploadedAt.getTime() + 4 * 60_000),
      });
    }
  });

  return { tender, documents, requirements, citations, keyDates, events, byQuestionRef, docById };
}

// ---------------------------------------------------------------------------
// Tender 1 — NHS Supply Chain, Managed Cleaning Services → NO BID
// ---------------------------------------------------------------------------

const nhsSpec: TenderSpec = {
  tender: {
    id: "tender-nhs",
    title: "NHS Supply Chain — Managed Cleaning Services",
    buyerName: "NHS Supply Chain",
    source: "find_a_tender",
    noticeReference: "ocds-h6vhtk-04a1f2",
    sourceUrl: "https://www.find-tender.service.gov.uk/Notice/024001-2026",
    contractValue: 2_400_000,
    currency: "GBP",
    durationMonths: 48,
    lotReference: null,
    status: "assessed",
  },
  createdDaysAgo: 26,
  docs: [
    { id: "psq", filename: "PSQ.pdf", docType: "psq", filePath: "/packs/nhs/psq.pdf", pageCount: 42 },
    { id: "itt", filename: "ITT.pdf", docType: "itt", filePath: "/packs/nhs/itt.pdf", pageCount: 61 },
    { id: "spec", filename: "Specification.pdf", docType: "specification", filePath: "/packs/nhs/specification.pdf", pageCount: 38 },
    { id: "eval", filename: "Evaluation Methodology.pdf", docType: "evaluation_methodology", filePath: "/packs/nhs/evaluation-methodology.pdf", pageCount: 12 },
  ],
  keyDates: [
    { kind: "submission_deadline", occursAt: daysFromNow(11, 12), doc: "itt", page: 4, quote: "Tenders must be received via the e-tendering portal no later than 12:00 noon on the Submission Deadline." },
    { kind: "clarification_deadline", occursAt: daysFromNow(4, 17), doc: "itt", page: 5, quote: "Clarification questions must be submitted no later than 17:00 on the Clarification Deadline. Questions received after this time will not be answered." },
    { kind: "contract_start", occursAt: daysFromNow(92, 0) },
  ],
  requirements: [
    // Blocking
    {
      kind: "certification",
      summary: "ISO 27001 certification",
      constraint: { credential_code: "ISO27001" },
      doc: "psq",
      page: 31,
      clause: "§4.2.1",
      quote: "The Bidder must hold a current ISO 27001 Information Security Management certification issued by a UKAS-accredited body, or an equivalent certification. Failure to provide evidence of certification will result in exclusion from the procurement.",
      also: [
        { doc: "itt", page: 14, clause: "§2.8", quote: "Bidders are reminded that the information security certification requirement at PSQ section 4.2.1 is a pass/fail condition of participation." },
      ],
    },
    {
      kind: "financial",
      summary: "Minimum annual turnover £5,000,000",
      constraint: { metric: "annual_turnover", operator: "gte", value: 5_000_000, currency: "GBP" },
      doc: "psq",
      page: 28,
      clause: "§3.4",
      quote: "Bidders must demonstrate a minimum annual turnover of £5,000,000 in their most recent audited financial year. This is a condition of participation and bidders who do not meet it will not proceed to the ITT stage.",
    },
    // Unknowns
    {
      kind: "insurance",
      summary: "Employers' liability cover ≥ £10,000,000",
      constraint: { insurance_kind: "employers_liability", min_cover: 10_000_000, currency: "GBP" },
      doc: "psq",
      page: 29,
      clause: "§3.6(a)",
      quote: "Employer's (Compulsory) Liability Insurance: £10,000,000 per occurrence. Bidders must either hold the required level of insurance or confirm that it will be in place prior to contract commencement.",
    },
    {
      kind: "financial",
      summary: "Net assets ≥ £500,000 in each of the last three financial years",
      constraint: { metric: "net_assets", operator: "gte", value: 500_000, currency: "GBP", years: 3 },
      doc: "psq",
      page: 28,
      clause: "§3.4.2",
      quote: "Bidders must demonstrate positive net assets of not less than £500,000 in each of the three most recent financial years for which accounts have been filed.",
    },
    {
      kind: "insurance",
      summary: "Cyber insurance cover ≥ £1,000,000",
      constraint: { insurance_kind: "cyber", min_cover: 1_000_000, currency: "GBP" },
      doc: "itt",
      page: 15,
      clause: "§2.9.3",
      quote: "The Supplier shall maintain cyber liability insurance with a limit of indemnity of not less than £1,000,000 for the duration of the Contract, in recognition of the patient-facing systems the Supplier's staff will access.",
    },
    // Passing mandatory
    {
      kind: "certification",
      summary: "ISO 9001 quality management certification",
      constraint: { credential_code: "ISO9001" },
      doc: "psq",
      page: 30,
      clause: "§4.1.1",
      quote: "The Bidder must hold ISO 9001 certification for quality management, or provide evidence of an equivalent quality management system audited by an independent third party.",
    },
    {
      kind: "certification",
      summary: "ISO 14001 environmental management certification",
      constraint: { credential_code: "ISO14001" },
      doc: "psq",
      page: 30,
      clause: "§4.1.2",
      quote: "The Bidder must hold ISO 14001 certification for environmental management or an equivalent certified environmental management system.",
    },
    {
      kind: "certification",
      summary: "SSIP-member health and safety accreditation (CHAS or equivalent)",
      constraint: { credential_code: "CHAS" },
      doc: "psq",
      page: 32,
      clause: "§4.3",
      quote: "The Bidder must hold a current health and safety accreditation from a member scheme of Safety Schemes in Procurement (SSIP), such as CHAS, SafeContractor or Constructionline.",
    },
    {
      kind: "certification",
      summary: "Cyber Essentials certification",
      constraint: { credential_code: "CYBER_ESSENTIALS" },
      doc: "psq",
      page: 31,
      clause: "§4.2.2",
      quote: "The Bidder must hold a current Cyber Essentials certificate as a minimum. Cyber Essentials Plus is desirable.",
    },
    {
      kind: "insurance",
      summary: "Public liability cover ≥ £10,000,000",
      constraint: { insurance_kind: "public_liability", min_cover: 10_000_000, currency: "GBP" },
      doc: "psq",
      page: 29,
      clause: "§3.6(b)",
      quote: "Public Liability Insurance: £10,000,000 per occurrence.",
    },
    {
      kind: "insurance",
      summary: "Professional indemnity cover ≥ £2,000,000",
      constraint: { insurance_kind: "professional_indemnity", min_cover: 2_000_000, currency: "GBP" },
      doc: "psq",
      page: 29,
      clause: "§3.6(c)",
      quote: "Professional Indemnity Insurance: £2,000,000 per claim.",
      also: [
        { doc: "itt", page: 15, clause: "§2.9.1", quote: "The Supplier shall maintain professional indemnity insurance of not less than £2,000,000 in respect of each and every claim throughout the Contract Period." },
      ],
    },
    {
      kind: "insurance",
      summary: "Public liability ≥ £5,000,000 for Category B premises",
      constraint: { insurance_kind: "public_liability", min_cover: 5_000_000, currency: "GBP" },
      doc: "spec",
      page: 22,
      clause: "§7.3",
      quote: "For Category B premises (clinical and theatre-adjacent areas) the Supplier must evidence public liability cover of not less than £5,000,000 for any one occurrence.",
    },
    {
      kind: "experience",
      summary: "At least two contracts ≥ £500,000 delivered in the last five years",
      constraint: { min_count: 2, min_value: 500_000, currency: "GBP", within_years: 5 },
      doc: "psq",
      page: 33,
      clause: "§5.1",
      quote: "Bidders must provide details of at least two contracts of similar scope and complexity, each with an annual value of not less than £500,000, delivered within the last five years.",
    },
    {
      kind: "experience",
      summary: "At least one public-sector contract in the last three years",
      constraint: { min_count: 1, public_sector_only: true, within_years: 3 },
      doc: "psq",
      page: 33,
      clause: "§5.2",
      quote: "At least one of the contracts cited must have been delivered for a public sector body within the last three years.",
    },
    {
      kind: "experience",
      summary: "At least one healthcare-sector contract in the last five years",
      constraint: { min_count: 1, sector: "healthcare", within_years: 5 },
      doc: "spec",
      page: 6,
      clause: "§1.4",
      quote: "The Supplier must have delivered cleaning services within an acute or community healthcare setting within the last five years, to the National Standards of Healthcare Cleanliness 2021 or their predecessor.",
    },
    {
      kind: "experience",
      summary: "Two public-sector references with contactable referees",
      constraint: { min_count: 2, public_sector_only: true, referee_contactable: true },
      doc: "psq",
      page: 34,
      clause: "§5.3",
      quote: "Bidders must supply two references from public sector clients. The Authority reserves the right to contact the referees named and to take their responses into account.",
    },
    {
      kind: "experience",
      summary: "Three contracts ≥ £300,000 in the last three years",
      constraint: { min_count: 3, min_value: 300_000, currency: "GBP", within_years: 3 },
      doc: "itt",
      page: 18,
      clause: "§3.2",
      quote: "Bidders shall evidence three contracts with an annual value in excess of £300,000, current or completed within the last three years.",
    },
    {
      kind: "financial",
      summary: "Turnover at least twice the annual contract value (£1,200,000)",
      constraint: { metric: "annual_turnover", operator: "gte", value: 1_200_000, currency: "GBP" },
      doc: "psq",
      page: 28,
      clause: "§3.4.1",
      quote: "In line with the Authority's financial standing policy, annual turnover must be at least twice the estimated annual value of the contract, being £1,200,000.",
    },
    {
      kind: "financial",
      summary: "Positive profit before tax in each of the last two years",
      constraint: { metric: "profit_before_tax", operator: "gt", value: 0, currency: "GBP", years: 2 },
      doc: "psq",
      page: 28,
      clause: "§3.4.3",
      quote: "Bidders must have recorded a profit before tax in each of the two most recent financial years.",
    },
    {
      kind: "financial",
      summary: "Two years of filed accounts",
      constraint: { metric: "annual_turnover", operator: "gte", value: 0, currency: "GBP", years: 2 },
      doc: "psq",
      page: 27,
      clause: "§3.3",
      quote: "Bidders must submit audited accounts, or accounts filed at Companies House, for the two most recent financial years.",
    },
    {
      kind: "financial",
      summary: "Net assets ≥ £250,000 in the most recent year",
      constraint: { metric: "net_assets", operator: "gte", value: 250_000, currency: "GBP" },
      doc: "itt",
      page: 13,
      clause: "§2.6",
      quote: "The Supplier's net assets in its most recent filed accounts shall not be less than £250,000.",
    },
    {
      kind: "financial",
      summary: "Turnover ≥ £3,000,000 in each of the last two years",
      constraint: { metric: "annual_turnover", operator: "gte", value: 3_000_000, currency: "GBP", years: 2 },
      doc: "itt",
      page: 13,
      clause: "§2.6.2",
      quote: "For the avoidance of doubt, suppliers shall demonstrate turnover of not less than £3,000,000 in each of the two financial years preceding the tender.",
    },
    {
      kind: "policy",
      summary: "Modern slavery statement",
      constraint: { policy_type: "modern_slavery" },
      doc: "psq",
      page: 35,
      clause: "§6.1",
      quote: "Bidders must confirm they have a Modern Slavery Statement in place that complies with section 54 of the Modern Slavery Act 2015, and provide a copy.",
    },
    {
      kind: "policy",
      summary: "Equality, diversity and inclusion policy",
      constraint: { policy_type: "equality" },
      doc: "psq",
      page: 35,
      clause: "§6.2",
      quote: "Bidders must have an equality and diversity policy that meets the requirements of the Equality Act 2010.",
    },
    {
      kind: "policy",
      summary: "Environmental policy",
      constraint: { policy_type: "environmental" },
      doc: "psq",
      page: 35,
      clause: "§6.3",
      quote: "Bidders must hold a written environmental policy signed by a director.",
    },
    {
      kind: "policy",
      summary: "Health and safety policy",
      constraint: { policy_type: "health_safety" },
      doc: "psq",
      page: 36,
      clause: "§6.4",
      quote: "Bidders with five or more employees must hold a written health and safety policy in accordance with section 2(3) of the Health and Safety at Work etc. Act 1974.",
    },
    // Desirable
    {
      kind: "certification",
      obligation: "desirable",
      summary: "ISO 45001 occupational health and safety certification",
      constraint: { credential_code: "ISO45001" },
      doc: "psq",
      page: 32,
      clause: "§4.4",
      quote: "ISO 45001 certification is desirable and will be taken into account at the quality evaluation stage.",
    },
    {
      kind: "certification",
      obligation: "desirable",
      summary: "Cyber Essentials Plus",
      constraint: { credential_code: "CYBER_ESSENTIALS_PLUS" },
      doc: "itt",
      page: 14,
      clause: "§2.8.1",
      quote: "Cyber Essentials Plus is desirable given the Supplier's access to Trust networks.",
    },
    {
      kind: "certification",
      obligation: "desirable",
      summary: "NHS Data Security and Protection Toolkit",
      constraint: { credential_code: "DSPT" },
      doc: "itt",
      page: 14,
      clause: "§2.8.2",
      quote: "Suppliers are encouraged to have completed the NHS Data Security and Protection Toolkit at the 'Standards Met' level.",
    },
    {
      kind: "policy",
      obligation: "desirable",
      summary: "Data protection policy",
      constraint: { policy_type: "data_protection" },
      doc: "psq",
      page: 36,
      clause: "§6.5",
      quote: "It is desirable that bidders hold a written data protection policy addressing UK GDPR obligations.",
    },
    {
      kind: "policy",
      obligation: "desirable",
      summary: "Carbon Reduction Plan (PPN 06/21)",
      constraint: { policy_type: "carbon_reduction" },
      doc: "itt",
      page: 21,
      clause: "§4.6",
      quote: "Bidders should publish a Carbon Reduction Plan in the format set out in PPN 06/21. Where the contract value falls below the £5m threshold this is desirable rather than mandatory.",
    },
    {
      kind: "insurance",
      obligation: "desirable",
      summary: "Product liability cover ≥ £5,000,000",
      constraint: { insurance_kind: "product_liability", min_cover: 5_000_000, currency: "GBP" },
      doc: "psq",
      page: 29,
      clause: "§3.6(d)",
      quote: "Product Liability Insurance: £5,000,000 (desirable, where the Bidder supplies consumables).",
    },
    {
      kind: "experience",
      obligation: "desirable",
      summary: "Previous NHS acute trust contract",
      constraint: { min_count: 1, sector: "healthcare", public_sector_only: true },
      doc: "eval",
      page: 7,
      clause: "Q3 guidance",
      quote: "Higher scores will be available to bidders able to evidence previous delivery for an NHS acute trust.",
    },
    {
      kind: "experience",
      obligation: "desirable",
      summary: "Local-authority contract experience",
      constraint: { min_count: 1, sector: "local_government" },
      doc: "eval",
      page: 8,
      clause: "Q5 guidance",
      quote: "Experience of delivering to a local authority or other public body in the region will be considered relevant to social value scoring.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Tender 2 — Camden LBC, Grounds Maintenance → REVIEW
// ---------------------------------------------------------------------------

const camdenSpec: TenderSpec = {
  tender: {
    id: "tender-camden",
    title: "Camden LBC — Grounds Maintenance",
    buyerName: "London Borough of Camden",
    source: "contracts_finder",
    noticeReference: "CF-2026-0917-GM",
    sourceUrl: "https://www.contractsfinder.service.gov.uk/Notice/2026-0917",
    contractValue: 780_000,
    currency: "GBP",
    durationMonths: 36,
    lotReference: null,
    status: "assessed",
  },
  createdDaysAgo: 9,
  docs: [
    { id: "notice", filename: "Contract Notice.pdf", docType: "contract_notice", filePath: "/packs/camden/contract-notice.pdf", pageCount: 6 },
    { id: "psq", filename: "PSQ.pdf", docType: "psq", filePath: "/packs/camden/psq.pdf", pageCount: 36 },
    { id: "itt", filename: "ITT and Specification.pdf", docType: "itt", filePath: "/packs/camden/itt-and-specification.pdf", pageCount: 54 },
    {
      id: "plans",
      filename: "Site plans.pdf",
      docType: "other",
      filePath: "/packs/camden/site-plans.pdf",
      pageCount: 9,
      extractionStatus: "failed",
      extractionError:
        "This PDF has no text layer. Verdict reads text-based PDFs only — try the buyer's original download rather than a scan.",
    },
    { id: "eval", filename: "Evaluation Methodology.pdf", docType: "evaluation_methodology", filePath: "/packs/camden/evaluation-methodology.pdf", pageCount: 11, failedChunks: 1, chunkCount: 3 },
  ],
  keyDates: [
    { kind: "submission_deadline", occursAt: daysFromNow(4, 12), doc: "itt", page: 3, quote: "The deadline for receipt of tenders is 12:00 noon on the date stated in the Contract Notice." },
    { kind: "clarification_deadline", occursAt: daysFromNow(-3, 16), doc: "itt", page: 3, quote: "Clarification questions must be raised through the portal by 16:00 on the clarification deadline." },
    { kind: "site_visit", occursAt: daysFromNow(2, 10), doc: "itt", page: 4, quote: "A non-mandatory site visit will be held at 10:00. Bidders wishing to attend must register through the portal." },
    { kind: "contract_start", occursAt: daysFromNow(61, 0) },
  ],
  requirements: [
    {
      kind: "insurance",
      summary: "Employers' liability cover ≥ £5,000,000",
      constraint: { insurance_kind: "employers_liability", min_cover: 5_000_000, currency: "GBP" },
      doc: "psq",
      page: 21,
      clause: "§5.1(a)",
      quote: "Employer's Liability: £5 million. The Council requires evidence that the required levels of insurance are held, or a commitment to obtain them prior to contract award.",
    },
    {
      kind: "insurance",
      summary: "Motor fleet cover ≥ £5,000,000 third-party",
      constraint: { insurance_kind: "motor_fleet", min_cover: 5_000_000, currency: "GBP" },
      doc: "psq",
      page: 21,
      clause: "§5.1(d)",
      quote: "Motor Vehicle Insurance (third party): £5 million, covering all vehicles and ride-on plant used in the delivery of the service on the public highway.",
    },
    {
      kind: "financial",
      summary: "Net assets positive in each of the last three years",
      constraint: { metric: "net_assets", operator: "gt", value: 0, currency: "GBP", years: 3 },
      doc: "psq",
      page: 19,
      clause: "§4.2",
      quote: "Bidders must demonstrate positive net assets in each of the last three financial years.",
    },
    {
      kind: "certification",
      summary: "ISO 9001 or equivalent quality management system",
      constraint: { credential_code: "ISO9001" },
      doc: "psq",
      page: 24,
      clause: "§6.1",
      quote: "Bidders must hold ISO 9001 or operate an equivalent documented quality management system subject to external audit.",
    },
    {
      kind: "certification",
      summary: "ISO 14001 environmental management",
      constraint: { credential_code: "ISO14001" },
      doc: "psq",
      page: 24,
      clause: "§6.2",
      quote: "Bidders must hold ISO 14001 certification. Grounds maintenance operations involve the use of pesticides and fuel and the Council requires a certified environmental management system.",
    },
    {
      kind: "certification",
      summary: "SSIP-member health and safety accreditation",
      constraint: { credential_code: "CHAS" },
      doc: "psq",
      page: 25,
      clause: "§6.3",
      quote: "Bidders must hold a current SSIP member scheme accreditation (for example CHAS or SafeContractor).",
    },
    {
      kind: "certification",
      summary: "Cyber Essentials",
      constraint: { credential_code: "CYBER_ESSENTIALS" },
      doc: "psq",
      page: 25,
      clause: "§6.4",
      quote: "As the contract will involve access to the Council's works-ordering system, bidders must hold Cyber Essentials certification.",
    },
    {
      kind: "insurance",
      summary: "Public liability cover ≥ £5,000,000",
      constraint: { insurance_kind: "public_liability", min_cover: 5_000_000, currency: "GBP" },
      doc: "psq",
      page: 21,
      clause: "§5.1(b)",
      quote: "Public Liability: £5 million per occurrence.",
    },
    {
      kind: "insurance",
      summary: "Professional indemnity cover ≥ £1,000,000",
      constraint: { insurance_kind: "professional_indemnity", min_cover: 1_000_000, currency: "GBP" },
      doc: "psq",
      page: 21,
      clause: "§5.1(c)",
      quote: "Professional Indemnity: £1 million (arboricultural advice).",
    },
    {
      kind: "experience",
      summary: "Two local-authority grounds contracts in the last five years",
      constraint: { min_count: 2, sector: "local_government", within_years: 5 },
      doc: "psq",
      page: 27,
      clause: "§7.1",
      quote: "Bidders must provide two examples of grounds maintenance contracts delivered for a local authority within the last five years.",
    },
    {
      kind: "experience",
      summary: "One contract ≥ £250,000 annual value",
      constraint: { min_count: 1, min_value: 250_000, currency: "GBP", within_years: 5 },
      doc: "psq",
      page: 27,
      clause: "§7.2",
      quote: "At least one example must have an annual value of £250,000 or more.",
    },
    {
      kind: "experience",
      summary: "Two public-sector referees the Council may contact",
      constraint: { min_count: 2, public_sector_only: true, referee_contactable: true },
      doc: "psq",
      page: 28,
      clause: "§7.3",
      quote: "Referees must be from public sector clients and must have consented to be contacted by the Council.",
    },
    {
      kind: "experience",
      summary: "At least one public-sector contract in the last three years",
      constraint: { min_count: 1, public_sector_only: true, within_years: 3 },
      doc: "notice",
      page: 4,
      clause: "II.2.9",
      quote: "Candidates must demonstrate recent (within three years) experience of delivering services to a public sector body.",
    },
    {
      kind: "financial",
      summary: "Turnover at least twice the annual contract value (£520,000)",
      constraint: { metric: "annual_turnover", operator: "gte", value: 520_000, currency: "GBP" },
      doc: "psq",
      page: 19,
      clause: "§4.1",
      quote: "Turnover in the most recent financial year must be at least twice the estimated annual contract value of £260,000.",
    },
    {
      kind: "financial",
      summary: "Profit before tax positive in the most recent year",
      constraint: { metric: "profit_before_tax", operator: "gt", value: 0, currency: "GBP" },
      doc: "psq",
      page: 19,
      clause: "§4.3",
      quote: "Bidders must not have recorded a loss before tax in the most recent financial year.",
    },
    {
      kind: "financial",
      summary: "Two years of filed accounts",
      constraint: { metric: "annual_turnover", operator: "gte", value: 0, currency: "GBP", years: 2 },
      doc: "psq",
      page: 18,
      clause: "§4.0",
      quote: "Provide full accounts for the last two financial years.",
    },
    {
      kind: "financial",
      summary: "Turnover ≥ £780,000 (contract value)",
      constraint: { metric: "annual_turnover", operator: "gte", value: 780_000, currency: "GBP" },
      doc: "itt",
      page: 9,
      clause: "§2.4",
      quote: "The Council will not award to any tenderer whose annual turnover is less than the total estimated contract value.",
    },
    {
      kind: "policy",
      summary: "Modern slavery statement",
      constraint: { policy_type: "modern_slavery" },
      doc: "psq",
      page: 30,
      clause: "§8.1",
      quote: "Bidders must provide a copy of their Modern Slavery Statement.",
    },
    {
      kind: "policy",
      summary: "Equality and diversity policy",
      constraint: { policy_type: "equality" },
      doc: "psq",
      page: 30,
      clause: "§8.2",
      quote: "Bidders must hold an equality and diversity policy compliant with the Equality Act 2010 and the Public Sector Equality Duty as it applies to contractors.",
    },
    {
      kind: "policy",
      summary: "Environmental policy",
      constraint: { policy_type: "environmental" },
      doc: "psq",
      page: 30,
      clause: "§8.3",
      quote: "Bidders must hold a written environmental policy.",
    },
    {
      kind: "policy",
      summary: "Health and safety policy",
      constraint: { policy_type: "health_safety" },
      doc: "psq",
      page: 31,
      clause: "§8.4",
      quote: "Bidders must hold a written health and safety policy and provide their accident statistics for the last three years.",
    },
    // Desirable
    {
      kind: "certification",
      obligation: "desirable",
      summary: "ISO 45001",
      constraint: { credential_code: "ISO45001" },
      doc: "psq",
      page: 25,
      clause: "§6.5",
      quote: "ISO 45001 is desirable.",
    },
    {
      kind: "certification",
      obligation: "desirable",
      summary: "SafeContractor",
      constraint: { credential_code: "SAFECONTRACTOR" },
      doc: "psq",
      page: 25,
      clause: "§6.5",
      quote: "SafeContractor accreditation is desirable in addition to the SSIP requirement above.",
    },
    {
      kind: "experience",
      obligation: "desirable",
      summary: "Education-sector experience",
      constraint: { min_count: 1, sector: "education" },
      doc: "itt",
      page: 31,
      clause: "Q4 guidance",
      quote: "Experience of maintaining school grounds will be considered advantageous for the safeguarding element of Question 4.",
    },
    {
      kind: "policy",
      obligation: "desirable",
      summary: "Data protection policy",
      constraint: { policy_type: "data_protection" },
      doc: "psq",
      page: 31,
      clause: "§8.5",
      quote: "A data protection policy is desirable.",
    },
    {
      kind: "insurance",
      obligation: "desirable",
      summary: "Cyber insurance",
      constraint: { insurance_kind: "cyber", min_cover: 500_000, currency: "GBP" },
      doc: "psq",
      page: 22,
      clause: "§5.2",
      quote: "Cyber insurance of £500,000 is desirable.",
    },
    // Informational
    {
      kind: "date",
      obligation: "informational",
      summary: "Non-mandatory site visit",
      constraint: { date_kind: "site_visit" },
      doc: "itt",
      page: 4,
      clause: "§1.6",
      quote: "A non-mandatory site visit will be held at 10:00. Bidders wishing to attend must register through the portal.",
    },
    {
      kind: "legal_status",
      obligation: "informational",
      summary: "Bidder must be a legal entity able to contract in England and Wales",
      constraint: {},
      doc: "psq",
      page: 8,
      clause: "§1.2",
      quote: "The bidder must be a legal entity capable of entering into a contract governed by the laws of England and Wales.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Tender 3 — University of Leeds, Soft FM Framework, Lot 2 → BID
// ---------------------------------------------------------------------------

const leedsSpec: TenderSpec = {
  tender: {
    id: "tender-leeds",
    title: "University of Leeds — Soft FM Framework",
    buyerName: "University of Leeds",
    source: "find_a_tender",
    noticeReference: "ocds-h6vhtk-0490aa",
    sourceUrl: "https://www.find-tender.service.gov.uk/Notice/022190-2026",
    contractValue: 1_100_000,
    currency: "GBP",
    durationMonths: 48,
    lotReference: "Lot 2",
    status: "bidding",
  },
  createdDaysAgo: 22,
  docs: [
    { id: "notice", filename: "Contract Notice.pdf", docType: "contract_notice", filePath: "/packs/leeds/contract-notice.pdf", pageCount: 5 },
    { id: "psq", filename: "PSQ.pdf", docType: "psq", filePath: "/packs/leeds/psq.pdf", pageCount: 40 },
    { id: "itt", filename: "ITT.pdf", docType: "itt", filePath: "/packs/leeds/itt.pdf", pageCount: 72 },
    { id: "spec", filename: "Specification - Lot 2.pdf", docType: "specification", filePath: "/packs/leeds/specification-lot-2.pdf", pageCount: 29 },
    { id: "eval", filename: "Evaluation Methodology.pdf", docType: "evaluation_methodology", filePath: "/packs/leeds/evaluation-methodology.pdf", pageCount: 14 },
    { id: "tcs", filename: "Terms and Conditions.pdf", docType: "terms_and_conditions", filePath: "/packs/leeds/terms-and-conditions.pdf", pageCount: 48 },
  ],
  keyDates: [
    { kind: "submission_deadline", occursAt: daysFromNow(19, 12), doc: "itt", page: 6, quote: "Tender responses must be uploaded to the University's e-tendering portal by 12:00 noon on the submission deadline." },
    { kind: "clarification_deadline", occursAt: daysFromNow(12, 17), doc: "itt", page: 6, quote: "The final date for clarification questions is seven calendar days before the submission deadline." },
    { kind: "presentation", occursAt: daysFromNow(33, 10), doc: "eval", page: 11, quote: "Shortlisted bidders may be invited to present to the evaluation panel." },
    { kind: "contract_start", occursAt: daysFromNow(75, 0) },
  ],
  requirements: [
    { kind: "certification", summary: "ISO 9001 quality management", constraint: { credential_code: "ISO9001" }, doc: "psq", page: 26, clause: "§5.1", quote: "Bidders must hold ISO 9001:2015 certification or an equivalent externally audited quality management system." },
    { kind: "certification", summary: "ISO 14001 environmental management", constraint: { credential_code: "ISO14001" }, doc: "psq", page: 26, clause: "§5.2", quote: "Bidders must hold ISO 14001:2015 certification or equivalent." },
    { kind: "certification", summary: "SSIP-member accreditation", constraint: { credential_code: "CHAS" }, doc: "psq", page: 27, clause: "§5.3", quote: "Bidders must hold a current SSIP member scheme accreditation such as CHAS." },
    { kind: "certification", summary: "Cyber Essentials", constraint: { credential_code: "CYBER_ESSENTIALS" }, doc: "psq", page: 27, clause: "§5.4", quote: "Suppliers with access to University systems must hold Cyber Essentials as a minimum." },
    { kind: "insurance", summary: "Public liability cover ≥ £5,000,000", constraint: { insurance_kind: "public_liability", min_cover: 5_000_000, currency: "GBP" }, doc: "psq", page: 22, clause: "§4.4(b)", quote: "Public Liability Insurance: £5,000,000 for any one occurrence." },
    { kind: "insurance", summary: "Professional indemnity cover ≥ £1,000,000", constraint: { insurance_kind: "professional_indemnity", min_cover: 1_000_000, currency: "GBP" }, doc: "psq", page: 22, clause: "§4.4(c)", quote: "Professional Indemnity Insurance: £1,000,000 for any one claim." },
    { kind: "financial", summary: "Turnover ≥ £1,000,000 in the most recent year", constraint: { metric: "annual_turnover", operator: "gte", value: 1_000_000, currency: "GBP" }, doc: "psq", page: 20, clause: "§4.1", quote: "Minimum annual turnover for Lot 2 is £1,000,000." },
    { kind: "financial", summary: "Turnover at least twice the annual lot value (£550,000)", constraint: { metric: "annual_turnover", operator: "gte", value: 550_000, currency: "GBP" }, doc: "psq", page: 20, clause: "§4.1.1", quote: "Turnover must be at least twice the estimated annual value of the lot, being £275,000 per annum." },
    { kind: "financial", summary: "Positive profit before tax in each of the last two years", constraint: { metric: "profit_before_tax", operator: "gt", value: 0, currency: "GBP", years: 2 }, doc: "psq", page: 20, clause: "§4.2", quote: "Bidders must have been profitable before tax in each of the two most recent financial years." },
    { kind: "financial", summary: "Net assets ≥ £100,000 in the most recent year", constraint: { metric: "net_assets", operator: "gte", value: 100_000, currency: "GBP" }, doc: "psq", page: 20, clause: "§4.3", quote: "Net assets in the most recent filed accounts must be not less than £100,000." },
    { kind: "financial", summary: "Two years of filed accounts", constraint: { metric: "annual_turnover", operator: "gte", value: 0, currency: "GBP", years: 2 }, doc: "psq", page: 19, clause: "§4.0", quote: "Accounts for the two most recent financial years must be provided." },
    { kind: "financial", summary: "Net assets positive in the last two years", constraint: { metric: "net_assets", operator: "gt", value: 0, currency: "GBP", years: 2 }, doc: "tcs", page: 12, clause: "cl. 9.3", quote: "The Supplier warrants that it has had positive net assets in each of the two financial years preceding the Framework Start Date." },
    { kind: "experience", summary: "Two contracts ≥ £300,000 in the last five years", constraint: { min_count: 2, min_value: 300_000, currency: "GBP", within_years: 5 }, doc: "psq", page: 30, clause: "§6.1", quote: "Provide two examples of contracts with an annual value of at least £300,000 delivered within the last five years." },
    { kind: "experience", summary: "One education-sector contract", constraint: { min_count: 1, sector: "education" }, doc: "psq", page: 30, clause: "§6.2", quote: "At least one example must be from a university, college or school." },
    { kind: "experience", summary: "One public-sector contract in the last three years", constraint: { min_count: 1, public_sector_only: true, within_years: 3 }, doc: "notice", page: 3, clause: "II.2.9", quote: "Recent public sector delivery experience (within three years) is a condition of participation." },
    { kind: "experience", summary: "Two contactable referees", constraint: { min_count: 2, referee_contactable: true }, doc: "psq", page: 31, clause: "§6.3", quote: "Two referees who have agreed to be contacted by the University." },
    { kind: "experience", summary: "Three contracts of any value in the last five years", constraint: { min_count: 3, within_years: 5 }, doc: "spec", page: 5, clause: "§1.3", quote: "The Supplier shall have a track record of at least three soft FM contracts in the last five years." },
    { kind: "experience", summary: "One contract ≥ £1,000,000 annual value", constraint: { min_count: 1, min_value: 1_000_000, currency: "GBP", within_years: 5 }, doc: "spec", page: 5, clause: "§1.4", quote: "For Lot 2, suppliers must evidence at least one contract with an annual value of £1,000,000 or above." },
    { kind: "policy", summary: "Modern slavery statement", constraint: { policy_type: "modern_slavery" }, doc: "psq", page: 33, clause: "§7.1", quote: "Provide your Modern Slavery Statement." },
    { kind: "policy", summary: "Equality, diversity and inclusion policy", constraint: { policy_type: "equality" }, doc: "psq", page: 33, clause: "§7.2", quote: "Provide your equality, diversity and inclusion policy." },
    { kind: "policy", summary: "Environmental policy", constraint: { policy_type: "environmental" }, doc: "psq", page: 33, clause: "§7.3", quote: "Provide your environmental policy." },
    { kind: "policy", summary: "Health and safety policy", constraint: { policy_type: "health_safety" }, doc: "psq", page: 34, clause: "§7.4", quote: "Provide your health and safety policy, signed within the last twelve months." },
    // Desirable
    { kind: "certification", obligation: "desirable", summary: "ISO 45001", constraint: { credential_code: "ISO45001" }, doc: "psq", page: 27, clause: "§5.5", quote: "ISO 45001 is desirable." },
    { kind: "certification", obligation: "desirable", summary: "ISO 27001", constraint: { credential_code: "ISO27001" }, doc: "psq", page: 27, clause: "§5.6", quote: "ISO 27001 is desirable for suppliers handling personal data." },
    { kind: "certification", obligation: "desirable", summary: "Cyber Essentials Plus", constraint: { credential_code: "CYBER_ESSENTIALS_PLUS" }, doc: "psq", page: 27, clause: "§5.6", quote: "Cyber Essentials Plus is desirable." },
    { kind: "certification", obligation: "desirable", summary: "Constructionline", constraint: { credential_code: "CONSTRUCTIONLINE" }, doc: "psq", page: 28, clause: "§5.7", quote: "Constructionline Gold membership is desirable for suppliers bidding across multiple lots." },
    { kind: "experience", obligation: "desirable", summary: "Healthcare-sector experience", constraint: { min_count: 1, sector: "healthcare" }, doc: "eval", page: 8, clause: "MS5 guidance", quote: "Experience in healthcare settings will be credited under the infection control element of Method Statement 5." },
    { kind: "policy", obligation: "desirable", summary: "Data protection policy", constraint: { policy_type: "data_protection" }, doc: "psq", page: 34, clause: "§7.5", quote: "A data protection policy is desirable." },
    // Method statements
    { kind: "question", summary: "MS1 — Mobilisation and TUPE", constraint: { question_ref: "Method Statement 1", word_limit: 1500, weighting: 15 }, doc: "itt", page: 41, clause: "MS1", quote: "Describe your approach to mobilising this contract, including your management of the TUPE transfer of the incumbent's staff, within 1,500 words.", questionRef: "Method Statement 1", wordLimit: 1500, weighting: 15 },
    { kind: "question", summary: "MS2 — Quality assurance and KPI monitoring", constraint: { question_ref: "Method Statement 2", word_limit: 1000, weighting: 10 }, doc: "itt", page: 43, clause: "MS2", quote: "Describe your quality management system and how you will monitor and report performance against the KPIs in Schedule 3. Maximum 1,000 words.", questionRef: "Method Statement 2", wordLimit: 1000, weighting: 10 },
    { kind: "question", summary: "MS3 — Social value", constraint: { question_ref: "Method Statement 3", word_limit: 1000, weighting: 10 }, doc: "itt", page: 45, clause: "MS3", quote: "Describe the social value you will deliver through this contract, with reference to the University's Social Value Framework. Maximum 1,000 words.", questionRef: "Method Statement 3", wordLimit: 1000, weighting: 10 },
    { kind: "question", summary: "MS4 — Environmental management and carbon", constraint: { question_ref: "Method Statement 4", word_limit: 800, weighting: 10 }, doc: "itt", page: 47, clause: "MS4", quote: "Describe how you will minimise the environmental impact of the service and contribute to the University's Climate Plan. Maximum 800 words.", questionRef: "Method Statement 4", wordLimit: 800, weighting: 10 },
    { kind: "question", summary: "MS5 — Safeguarding and vetting", constraint: { question_ref: "Method Statement 5", word_limit: 800, weighting: 5 }, doc: "itt", page: 49, clause: "MS5", quote: "Describe your safeguarding arrangements and staff vetting process for a campus environment. Maximum 800 words.", questionRef: "Method Statement 5", wordLimit: 800, weighting: 5 },
    { kind: "question", summary: "MS6 — Business continuity", constraint: { question_ref: "Method Statement 6", word_limit: 600, weighting: 5 }, doc: "itt", page: 51, clause: "MS6", quote: "Describe your business continuity arrangements, including cover for staff absence. Maximum 600 words.", questionRef: "Method Statement 6", wordLimit: 600, weighting: 5 },
    { kind: "question", summary: "MS7 — Staff training and retention", constraint: { question_ref: "Method Statement 7", word_limit: 800, weighting: 5 }, doc: "itt", page: 53, clause: "MS7", quote: "Describe your approach to training, developing and retaining staff on this contract. Maximum 800 words.", questionRef: "Method Statement 7", wordLimit: 800, weighting: 5 },
    { kind: "question", summary: "MS8 — Health and safety management", constraint: { question_ref: "Method Statement 8", word_limit: 800, weighting: 5 }, doc: "itt", page: 55, clause: "MS8", quote: "Describe how you will manage health and safety on a multi-building campus with 24-hour access. Maximum 800 words.", questionRef: "Method Statement 8", wordLimit: 800, weighting: 5 },
    // Informational
    { kind: "date", obligation: "informational", summary: "Submission deadline 12:00 noon", constraint: { date_kind: "submission_deadline" }, doc: "itt", page: 6, clause: "§1.8", quote: "Tender responses must be uploaded to the University's e-tendering portal by 12:00 noon on the submission deadline." },
    { kind: "date", obligation: "informational", summary: "Clarification deadline seven days before submission", constraint: { date_kind: "clarification_deadline" }, doc: "itt", page: 6, clause: "§1.9", quote: "The final date for clarification questions is seven calendar days before the submission deadline." },
    { kind: "date", obligation: "informational", summary: "Bidder presentations for shortlisted suppliers", constraint: { date_kind: "presentation" }, doc: "eval", page: 11, clause: "§5.2", quote: "Shortlisted bidders may be invited to present to the evaluation panel." },
    { kind: "legal_status", obligation: "informational", summary: "UK-registered legal entity", constraint: {}, doc: "psq", page: 6, clause: "§1.1", quote: "The bidder must be a legal entity registered in the United Kingdom or able to demonstrate an equivalent legal status." },
    { kind: "other", obligation: "informational", summary: "No guarantee of call-off volume under the framework", constraint: {}, doc: "tcs", page: 4, clause: "cl. 2.2", quote: "The University gives no guarantee as to the volume or value of call-off contracts that will be awarded under the Framework Agreement." },
  ],
};

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

export function buildSeed(): Store {
  idCounter = 0;
  const nhs = buildTender(nhsSpec);
  const camden = buildTender(camdenSpec);
  const leeds = buildTender(leedsSpec);

  const profile: ProfileSnapshot = {
    organisation,
    credentials,
    credentialTypes,
    financialYears,
    insurances,
    pastProjects,
    policies,
  };
  // Version 1 of the NHS assessment ran while public liability cover was still £5m.
  const profileBeforeRenewal: ProfileSnapshot = {
    ...profile,
    insurances: insurances.map((i) => (i.kind === "public_liability" ? { ...i, coverAmount: 5_000_000, expiresOn: on(2026, 3, 31) } : i)),
  };

  const assessments: Assessment[] = [];
  const results: AssessmentResult[] = [];
  const events: Omit<Event, "id">[] = [...nhs.events, ...camden.events, ...leeds.events];

  function seedAssessment(built: BuiltTender, version: number, asOf: Date, snapshot: ProfileSnapshot) {
    const deadline = built.keyDates.find((k) => k.kind === "submission_deadline")?.occursAt ?? null;
    const out = buildAssessment({
      tenderId: built.tender.id,
      orgId: DEMO_ORG_ID,
      version,
      requirements: built.requirements,
      profile: snapshot,
      asOf,
      deadline,
      runById: DEMO_USER_ID,
      newId: () => id("asm"),
    });
    assessments.push(out.assessment);
    results.push(...out.results);
    events.push({
      orgId: DEMO_ORG_ID,
      actorId: DEMO_USER_ID,
      actorKind: "user",
      action: "assessment.run",
      subjectTable: "assessments",
      subjectId: out.assessment.id,
      payload: {
        tenderId: built.tender.id,
        version,
        recommendation: out.assessment.recommendation,
        mandatoryPassed: out.assessment.mandatoryPassed,
        mandatoryFailed: out.assessment.mandatoryFailed,
        mandatoryUnknown: out.assessment.mandatoryUnknown,
        deadlineUsed: deadline?.toISOString() ?? null,
        asOfUsed: asOf.toISOString(),
      },
      createdAt: asOf,
    });
    return out.assessment;
  }

  seedAssessment(nhs, 1, daysFromNow(-25, 14), profileBeforeRenewal);
  events.push({
    orgId: DEMO_ORG_ID,
    actorId: DEMO_USER_ID,
    actorKind: "user",
    action: "profile.updated",
    subjectTable: "insurances",
    subjectId: "ins-pl",
    payload: { section: "insurances", change: "updated", label: "Public liability" },
    createdAt: daysFromNow(-23, 10),
  });
  seedAssessment(leeds, 1, daysFromNow(-21, 16), profile);
  seedAssessment(nhs, 2, daysFromNow(-13, 11), profile);
  seedAssessment(camden, 1, daysFromNow(-8, 15), profile);

  // Leeds moved to bidding the day after its assessment.
  events.push({
    orgId: DEMO_ORG_ID,
    actorId: DEMO_USER_ID,
    actorKind: "user",
    action: "tender.status_changed",
    subjectTable: "tenders",
    subjectId: leeds.tender.id,
    payload: { tenderId: leeds.tender.id, from: "assessed", to: "bidding" },
    createdAt: daysFromNow(-20, 9),
  });

  // Workspace: one task per method statement on the Leeds tender.
  const tasks: BidTask[] = [];
  const responses: Response[] = [];
  const taskPlan: Array<{
    ref: string;
    assignee: string | null;
    status: BidTask["status"];
    dueDays: number;
    body?: string;
    sourceAnswerId?: string;
  }> = [
    { ref: "Method Statement 1", assignee: DEMO_USER_ID, status: "in_progress", dueDays: 12, body: MS1_DRAFT, sourceAnswerId: "lib-tupe" },
    { ref: "Method Statement 2", assignee: "user-tom", status: "in_review", dueDays: 10, body: MS2_DRAFT, sourceAnswerId: "lib-quality" },
    { ref: "Method Statement 3", assignee: "user-hannah", status: "in_progress", dueDays: 14, body: MS3_DRAFT, sourceAnswerId: "lib-social-value" },
    { ref: "Method Statement 4", assignee: null, status: "not_started", dueDays: 14 },
    { ref: "Method Statement 5", assignee: "user-tom", status: "not_started", dueDays: 15 },
    { ref: "Method Statement 6", assignee: DEMO_USER_ID, status: "complete", dueDays: 8, body: MS6_FINAL, sourceAnswerId: "lib-bc" },
    { ref: "Method Statement 7", assignee: "user-hannah", status: "in_progress", dueDays: 15, body: MS7_DRAFT },
    { ref: "Method Statement 8", assignee: null, status: "not_started", dueDays: 16 },
  ];
  taskPlan.forEach((plan, i) => {
    const requirement = leeds.byQuestionRef.get(plan.ref);
    if (!requirement) throw new Error(`Seed: no requirement for ${plan.ref}`);
    const createdAt = daysFromNow(-20, 10 + i);
    tasks.push({
      id: id("task"),
      tenderId: leeds.tender.id,
      orgId: DEMO_ORG_ID,
      requirementId: requirement.id,
      title: requirement.summary,
      assigneeId: plan.assignee,
      status: plan.status,
      dueOn: daysFromNow(plan.dueDays, 0),
      createdAt,
      updatedAt: plan.body ? daysFromNow(-2, 10 + i) : createdAt,
    });
    if (plan.body) {
      responses.push({
        id: id("resp"),
        requirementId: requirement.id,
        orgId: DEMO_ORG_ID,
        body: plan.body,
        sourceAnswerId: plan.sourceAnswerId ?? null,
        updatedById: plan.assignee,
        createdAt,
        updatedAt: daysFromNow(-2, 10 + i),
      });
      if (plan.sourceAnswerId) {
        events.push({
          orgId: DEMO_ORG_ID,
          actorId: plan.assignee,
          actorKind: "user",
          action: "library.answer_used",
          subjectTable: "responses",
          subjectId: requirement.id,
          payload: {
            tenderId: leeds.tender.id,
            questionRef: plan.ref,
            answerId: plan.sourceAnswerId,
            answerTitle: libraryAnswers.find((a) => a.id === plan.sourceAnswerId)?.title,
          },
          createdAt: daysFromNow(-6, 11 + i),
        });
      }
      events.push({
        orgId: DEMO_ORG_ID,
        actorId: plan.assignee,
        actorKind: "user",
        action: "response.saved",
        subjectTable: "responses",
        subjectId: requirement.id,
        payload: { tenderId: leeds.tender.id, questionRef: plan.ref, words: plan.body.trim().split(/\s+/).length },
        createdAt: daysFromNow(-2, 10 + i),
      });
    }
  });

  const sortedEvents = events
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((e, i) => ({ ...e, id: String(i + 1) }));

  return {
    users: [...users],
    organisations: [organisation],
    memberships: [...memberships],
    credentialTypes: [...credentialTypes],
    credentials: [...credentials],
    financialYears: [...financialYears],
    insurances: [...insurances],
    pastProjects: [...pastProjects],
    policies: [...policies],
    tenders: [nhs.tender, camden.tender, leeds.tender],
    documents: [...nhs.documents, ...camden.documents, ...leeds.documents],
    requirements: [...nhs.requirements, ...camden.requirements, ...leeds.requirements],
    citations: [...nhs.citations, ...camden.citations, ...leeds.citations],
    keyDates: [...nhs.keyDates, ...camden.keyDates, ...leeds.keyDates],
    assessments,
    results,
    tasks,
    responses,
    libraryAnswers: [...libraryAnswers],
    events: sortedEvents,
    nextEventId: sortedEvents.length + 1,
  };
}

// ---------------------------------------------------------------------------
// Draft responses for the Leeds workspace
// ---------------------------------------------------------------------------

const MS1_DRAFT = `Meridian has received 214 employees under TUPE across eleven transfers in the last five years and has never had a claim upheld at tribunal. We will apply the same process to the 27 staff currently employed by the incumbent on Lot 2.

Mobilisation begins with a data request to the outgoing contractor within two working days of award, using the Employee Liability Information template. We will hold a collective consultation meeting on campus within ten days and offer individual meetings to every transferring employee. Each will receive a written summary of their existing terms and a named contact in our HR team.

Terms and conditions transfer intact. Where our own operatives on neighbouring contracts are on better terms, we harmonise upward at the first anniversary of transfer.

A dedicated mobilisation manager, Hannah Reid, will be assigned from award to the end of the first quarter. She will issue a weekly mobilisation report to the University's contract manager covering staffing, equipment, training completion and any measures proposed under Regulation 13.

[Priya: still to add the 12-week mobilisation plan table and the campus-specific induction content for the Bright Building and Parkinson Building.]`;

const MS2_DRAFT = `Our quality management system is certified to ISO 9001:2015 (certificate MF-Q-2291). Every building on Lot 2 will have a cleaning specification broken down into task frequencies, and every task frequency has an audit standard drawn from Schedule 3.

Supervisors audit 10% of areas each week using a tablet-based audit application with photographs. University representatives can join any audit and receive the report the same day. Scores below 85% trigger a corrective action with a named owner and a re-audit within five working days.

Monthly KPI reports cover audit scores, response times for reactive requests, absence and cover rates, training completion and complaints. We hold a monthly contract review meeting with the University and a quarterly review with our Operations Director.

We will report against the eight KPIs in Schedule 3 using the University's own scoring thresholds. Where a KPI is missed in two consecutive months we will submit a written improvement plan within five working days, as Schedule 3 requires, and we will not wait to be asked.

Complaints are logged on receipt, acknowledged within one working day and closed within five, with a root-cause note on every closed complaint. We share the complaints log in full at each monthly review.

Our audit application exports directly to the University's CAFM system so that audit scores and reactive job completion times are visible to the contract manager without waiting for the monthly report.

We will also propose two service improvements each quarter, drawn from the audit and complaints data, and record whether each is adopted.

Staff are trained to the British Institute of Cleaning Science Cleaning Professional's Skills Suite. Training completion is tracked per operative and reported monthly. Supervisors hold the BICSc Assessor qualification and re-assess each operative annually.

The Operations Director reviews the contract's audit and KPI data monthly and signs off the report before it is issued.`;

const MS3_DRAFT = `Meridian recruits within a five-mile radius of every site we serve. On the Wythenshawe outpatients contract 31 of 34 operatives lived in the M22 and M23 postcodes, and 6 were recruited through the Trust's own Working Well programme.

For Lot 2 we commit to one Level 2 Facilities Services apprenticeship for every £250,000 of annual contract value, delivered with Leeds City College. Apprentices are paid the Real Living Wage from day one.

Our social value plan will be measured against the University's Social Value Framework and reported quarterly, listing local hires, apprenticeship starts and completions, volunteer hours and spend with local SMEs and VCSEs.

[Hannah: need to map the four Framework themes to our commitments and add the student employment offer.]`;

const MS6_FINAL = `Our business continuity plan is reviewed every twelve months and tested annually through a desktop exercise, most recently for a severe weather scenario in January 2026.

Staffing continuity is the main risk on a cleaning contract. Every building on Lot 2 will have a trained relief pool of at least 15% of headcount, drawn from operatives on our Trafford College and Co-op contracts who will be inducted on campus during mobilisation. Absence is reported by 6am and covered by 7am, and our monthly reports record the cover rate achieved.

Equipment and consumables are held at two-week stock levels on campus, with a central store in Trafford Park that can resupply Leeds within four hours by our own vehicle.

In the event of a business-wide incident, the Operations Director takes the role of incident lead and the University's contract manager is contacted within one hour with an assessment of any effect on service. Our plan includes arrangements for loss of our head office, loss of IT systems, and the loss of a key supplier, each with a named alternative.

We hold cyber and business interruption cover and back up all contract data nightly to a second UK data centre.`;

const MS7_DRAFT = `Every operative completes a two-day induction covering the University's site rules, safeguarding, COSHH, manual handling and the specific specification for their building. Induction is recorded per person and refreshed annually.

We pay the Real Living Wage on all contracts and offer a guaranteed-hours contract to every operative after twelve weeks.

[Hannah: retention figures — 2025 turnover was 18% against sector 32%; add the supervisor development route and the BICSc training plan.]`;
