import { cn } from "@/lib/utils";

/** Loading states are skeleton rows matching the real layout (§12.7). Static: no pulse, no motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("rounded-sm bg-rule/60", className)} {...props} />;
}

export { Skeleton };
