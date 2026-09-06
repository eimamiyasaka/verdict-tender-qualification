import { AppShell } from "@/components/shell/app-shell";
import { getOrgContext } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await getOrgContext();
  return <AppShell context={context}>{children}</AppShell>;
}
