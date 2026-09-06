-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('draft', 'extracting', 'extraction_failed', 'extracted', 'assessed', 'bidding', 'submitted', 'won', 'lost', 'abandoned');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('contract_notice', 'specification', 'psq', 'itt', 'pricing_schedule', 'terms_and_conditions', 'evaluation_methodology', 'clarification_log', 'other');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('pending', 'running', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('certification', 'financial', 'insurance', 'experience', 'policy', 'legal_status', 'resource', 'question', 'date', 'other');

-- CreateEnum
CREATE TYPE "Obligation" AS ENUM ('mandatory', 'desirable', 'informational');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('pass', 'fail', 'unknown', 'not_applicable');

-- CreateEnum
CREATE TYPE "BidRecommendation" AS ENUM ('bid', 'no_bid', 'review');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('not_started', 'in_progress', 'in_review', 'complete');

-- CreateEnum
CREATE TYPE "FinancialMetric" AS ENUM ('annual_turnover', 'net_assets', 'profit_before_tax', 'current_ratio', 'credit_score');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('employers_liability', 'public_liability', 'professional_indemnity', 'product_liability', 'cyber', 'contract_works', 'motor_fleet');

-- CreateEnum
CREATE TYPE "KeyDateKind" AS ENUM ('clarification_deadline', 'submission_deadline', 'site_visit', 'presentation', 'award_notification', 'contract_start', 'contract_end');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "companies_house_number" TEXT,
    "headcount" INTEGER,
    "registered_region" TEXT,
    "sic_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_types" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "reference" TEXT,
    "issued_on" DATE,
    "expires_on" DATE,
    "evidence_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_years" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "year_ending" DATE NOT NULL,
    "turnover" DECIMAL(14,2),
    "net_assets" DECIMAL(14,2),
    "profit_before_tax" DECIMAL(14,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'GBP',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurances" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "kind" "InsuranceType" NOT NULL,
    "cover_amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GBP',
    "insurer" TEXT,
    "expires_on" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "past_projects" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "client_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contract_value" DECIMAL(14,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'GBP',
    "sector" TEXT,
    "started_on" DATE,
    "ended_on" DATE,
    "is_public_sector" BOOLEAN NOT NULL DEFAULT false,
    "referee_contactable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "past_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "policy_type" TEXT NOT NULL,
    "title" TEXT,
    "last_reviewed" DATE,
    "document_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "buyer_name" TEXT,
    "source" TEXT,
    "notice_reference" TEXT,
    "source_url" TEXT,
    "contract_value" DECIMAL(14,2),
    "currency" CHAR(3) DEFAULT 'GBP',
    "duration_months" INTEGER,
    "lot_reference" TEXT,
    "status" "TenderStatus" NOT NULL DEFAULT 'draft',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_documents" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "doc_type" "DocumentType" NOT NULL DEFAULT 'other',
    "file_path" TEXT,
    "page_count" INTEGER,
    "extraction_status" "ExtractionStatus" NOT NULL DEFAULT 'pending',
    "extraction_error" TEXT,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "obligation" "Obligation" NOT NULL DEFAULT 'mandatory',
    "summary" TEXT NOT NULL,
    "constraint_json" JSONB NOT NULL,
    "document_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "quoted_clause" TEXT NOT NULL,
    "clause_reference" TEXT,
    "question_ref" TEXT,
    "word_limit" INTEGER,
    "weighting" DECIMAL(5,2),
    "extraction_confidence" DECIMAL(3,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_citations" (
    "id" UUID NOT NULL,
    "requirement_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "quoted_clause" TEXT NOT NULL,
    "clause_reference" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_dates" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "kind" "KeyDateKind" NOT NULL,
    "occurs_at" TIMESTAMPTZ(6) NOT NULL,
    "document_id" UUID,
    "page_number" INTEGER,
    "quoted_clause" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "recommendation" "BidRecommendation" NOT NULL,
    "mandatory_total" INTEGER NOT NULL DEFAULT 0,
    "mandatory_passed" INTEGER NOT NULL DEFAULT 0,
    "mandatory_failed" INTEGER NOT NULL DEFAULT 0,
    "mandatory_unknown" INTEGER NOT NULL DEFAULT 0,
    "desirable_score" DECIMAL(5,2),
    "rationale" TEXT,
    "deadline_used" TIMESTAMPTZ(6),
    "as_of_used" TIMESTAMPTZ(6) NOT NULL,
    "run_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_results" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "requirement_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "verdict" "Verdict" NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "warning" TEXT,
    "overridden_by_id" UUID,
    "override_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_tasks" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "requirement_id" UUID,
    "title" TEXT NOT NULL,
    "assignee_id" UUID,
    "status" "TaskStatus" NOT NULL DEFAULT 'not_started',
    "due_on" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bid_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" UUID NOT NULL,
    "requirement_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "source_answer_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_answers" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_tender_id" UUID,
    "times_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" BIGSERIAL NOT NULL,
    "org_id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_kind" TEXT NOT NULL DEFAULT 'user',
    "action" TEXT NOT NULL,
    "subject_table" TEXT,
    "subject_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_org_id_user_id_key" ON "memberships"("org_id", "user_id");

-- CreateIndex
CREATE INDEX "credentials_org_id_idx" ON "credentials"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_org_id_code_key" ON "credentials"("org_id", "code");

-- CreateIndex
CREATE INDEX "financial_years_org_id_year_ending_idx" ON "financial_years"("org_id", "year_ending");

-- CreateIndex
CREATE UNIQUE INDEX "financial_years_org_id_year_ending_key" ON "financial_years"("org_id", "year_ending");

-- CreateIndex
CREATE INDEX "insurances_org_id_idx" ON "insurances"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "insurances_org_id_kind_key" ON "insurances"("org_id", "kind");

-- CreateIndex
CREATE INDEX "past_projects_org_id_ended_on_idx" ON "past_projects"("org_id", "ended_on");

-- CreateIndex
CREATE INDEX "policies_org_id_idx" ON "policies"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "policies_org_id_policy_type_key" ON "policies"("org_id", "policy_type");

-- CreateIndex
CREATE INDEX "tenders_org_id_status_idx" ON "tenders"("org_id", "status");

-- CreateIndex
CREATE INDEX "tender_documents_tender_id_idx" ON "tender_documents"("tender_id");

-- CreateIndex
CREATE INDEX "requirements_tender_id_obligation_idx" ON "requirements"("tender_id", "obligation");

-- CreateIndex
CREATE INDEX "requirements_tender_id_kind_idx" ON "requirements"("tender_id", "kind");

-- CreateIndex
CREATE INDEX "requirements_document_id_idx" ON "requirements"("document_id");

-- CreateIndex
CREATE INDEX "requirement_citations_requirement_id_idx" ON "requirement_citations"("requirement_id");

-- CreateIndex
CREATE INDEX "key_dates_tender_id_occurs_at_idx" ON "key_dates"("tender_id", "occurs_at");

-- CreateIndex
CREATE INDEX "assessments_tender_id_version_idx" ON "assessments"("tender_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_tender_id_version_key" ON "assessments"("tender_id", "version");

-- CreateIndex
CREATE INDEX "assessment_results_assessment_id_verdict_idx" ON "assessment_results"("assessment_id", "verdict");

-- CreateIndex
CREATE INDEX "assessment_results_requirement_id_idx" ON "assessment_results"("requirement_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_results_assessment_id_requirement_id_key" ON "assessment_results"("assessment_id", "requirement_id");

-- CreateIndex
CREATE INDEX "bid_tasks_tender_id_status_idx" ON "bid_tasks"("tender_id", "status");

-- CreateIndex
CREATE INDEX "bid_tasks_assignee_id_idx" ON "bid_tasks"("assignee_id");

-- CreateIndex
CREATE UNIQUE INDEX "responses_requirement_id_key" ON "responses"("requirement_id");

-- CreateIndex
CREATE INDEX "library_answers_org_id_idx" ON "library_answers"("org_id");

-- CreateIndex
CREATE INDEX "events_org_id_created_at_idx" ON "events"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "events_subject_table_subject_id_idx" ON "events"("subject_table", "subject_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_code_fkey" FOREIGN KEY ("code") REFERENCES "credential_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_years" ADD CONSTRAINT "financial_years_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurances" ADD CONSTRAINT "insurances_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "past_projects" ADD CONSTRAINT "past_projects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_documents" ADD CONSTRAINT "tender_documents_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_documents" ADD CONSTRAINT "tender_documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "tender_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_citations" ADD CONSTRAINT "requirement_citations_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_citations" ADD CONSTRAINT "requirement_citations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_citations" ADD CONSTRAINT "requirement_citations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "tender_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_dates" ADD CONSTRAINT "key_dates_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_dates" ADD CONSTRAINT "key_dates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_dates" ADD CONSTRAINT "key_dates_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "tender_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_run_by_id_fkey" FOREIGN KEY ("run_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_overridden_by_id_fkey" FOREIGN KEY ("overridden_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_tasks" ADD CONSTRAINT "bid_tasks_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_tasks" ADD CONSTRAINT "bid_tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_tasks" ADD CONSTRAINT "bid_tasks_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_tasks" ADD CONSTRAINT "bid_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_source_answer_id_fkey" FOREIGN KEY ("source_answer_id") REFERENCES "library_answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_answers" ADD CONSTRAINT "library_answers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_answers" ADD CONSTRAINT "library_answers_source_tender_id_fkey" FOREIGN KEY ("source_tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- HAND-APPENDED raw SQL — spec §7.8. Prisma cannot express CHECK constraints,
-- so these were pasted into the generated init migration before it was applied.
-- Do not move them into a later migration: the invariants must exist from the
-- first row ever inserted. Prisma does not model CHECK constraints, so they are
-- invisible to `prisma migrate diff`, `migrate dev` drift detection and
-- `db pull` (verified: both diffs report "No difference detected"). This file
-- is therefore their only source of truth — a `migrate reset` re-applies them,
-- but a schema regenerated from introspection would silently lose them.
-- ---------------------------------------------------------------------------

-- Invariant 2 — constraint shape enforced by the database.
-- A model that hallucinates a `certification` requirement with no
-- `credential_code` gets a database error, not a row the evaluator cannot read.
-- The same shapes are validated by Zod at the insert boundary
-- (src/lib/ingest/persist.ts); this CHECK is the backstop for anything that
-- bypasses it.
alter table requirements add constraint constraint_shape_valid check (
  case kind
    when 'certification' then constraint_json ? 'credential_code'
    when 'financial'     then constraint_json ?& array['metric','operator','value']
    when 'insurance'     then constraint_json ?& array['insurance_kind','min_cover']
    when 'experience'    then constraint_json ? 'min_count'
    when 'policy'        then constraint_json ? 'policy_type'
    else true
  end
);

-- Non-negotiable citation constraints (Invariant 1, the numeric half).
alter table requirements add constraint page_number_positive check (page_number > 0);
alter table requirements add constraint quoted_clause_length check (char_length(quoted_clause) between 1 and 1200);
