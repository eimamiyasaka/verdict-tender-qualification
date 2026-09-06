import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-32 w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm leading-relaxed text-ink transition-colors placeholder:text-ink/40 hover:border-ink/60 focus:border-ink aria-invalid:border-flag disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
