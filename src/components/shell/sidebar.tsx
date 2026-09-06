"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Pipeline", match: (p: string) => p === "/" || p.startsWith("/tenders") },
  { href: "/profile", label: "Profile", match: (p: string) => p.startsWith("/profile") },
  { href: "/library", label: "Library", match: (p: string) => p.startsWith("/library") },
];

/**
 * Slim left sidebar (§12.1): wordmark in the mono face, three destinations,
 * organisation and sign-out at the bottom. Collapses to a top bar under md.
 */
export function SidebarNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className={cn(orientation === "vertical" ? "flex flex-col gap-0.5" : "flex items-center gap-1")}>
      {NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-sm text-sm transition-colors",
              orientation === "vertical" ? "-mx-2 px-2 py-1.5" : "px-2 py-1",
              active ? "font-medium text-ink" : "text-ink/60 hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
