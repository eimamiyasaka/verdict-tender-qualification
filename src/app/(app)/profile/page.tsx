import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/layout";
import { CredentialsSection } from "@/components/profile/credentials-section";
import { FinancialSection } from "@/components/profile/financial-section";
import { InsuranceSection } from "@/components/profile/insurance-section";
import { OrganisationForm } from "@/components/profile/organisation-form";
import { PoliciesSection } from "@/components/profile/policies-section";
import { ProjectsSection } from "@/components/profile/projects-section";
import { ProfileSection } from "@/components/profile/section";
import { getOrgContext } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profile";

export const metadata: Metadata = { title: "Company profile" };

const SECTIONS = [
  { id: "organisation", label: "Organisation" },
  { id: "credentials", label: "Certifications" },
  { id: "financial-years", label: "Financial years" },
  { id: "insurance", label: "Insurance" },
  { id: "past-projects", label: "Past projects" },
  { id: "policies", label: "Policies" },
];

/**
 * Company profile (§10.3): five sections matching the capability tables plus
 * organisation details. Every row says how many requirements read it.
 */
export default async function ProfilePage() {
  const { orgId } = await getOrgContext();
  const profile = await getProfile(orgId);
  if (!profile) throw new Error("Your organisation's profile could not be loaded.");
  const now = new Date();
  const gapCount = profile.gaps.credentials.length + profile.gaps.insurances.length + profile.gaps.policies.length;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Company profile"
        description="Everything Verdict checks a tender against. Verdicts are arithmetic over these facts, so what is missing here shows up as a fail or an unknown on every tender."
      />

      <nav aria-label="Profile sections" className="-mt-4 flex flex-wrap gap-x-4 gap-y-1 border-b border-rule pb-3 text-[13px]">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-sm text-ink/60 hover:text-ink hover:underline">
            {s.label}
          </a>
        ))}
        {gapCount > 0 ? <span className="ml-auto text-pending">{gapCount} asked for but not recorded</span> : null}
      </nav>

      {profile.staleAssessments.length > 0 ? (
        <div className="rounded-sm border border-rule px-4 py-3 text-sm text-ink">
          <p>
            The profile has changed since {profile.staleAssessments.length === 1 ? "this tender was" : "these tenders were"} last assessed.
            Their verdicts describe the profile as it was then:
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {profile.staleAssessments.map((t) => (
              <li key={t.id}>
                <Link href={`/tenders/${t.id}`} className="rounded-sm underline underline-offset-4 hover:text-ink/80">
                  {t.title}
                </Link>
                <span className="text-ink/60"> — re-run from the tender</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ProfileSection id="organisation" title="Organisation" description="Headcount and registered region are part of what the evaluator reads.">
        <OrganisationForm organisation={profile.organisation} />
      </ProfileSection>

      <CredentialsSection rows={profile.credentials} types={profile.credentialTypes} gaps={profile.gaps.credentials} now={now} />
      <FinancialSection rows={profile.financialYears} />
      <InsuranceSection rows={profile.insurances} gaps={profile.gaps.insurances} now={now} />
      <ProjectsSection rows={profile.pastProjects} />
      <PoliciesSection rows={profile.policies} gaps={profile.gaps.policies} now={now} />
    </div>
  );
}
