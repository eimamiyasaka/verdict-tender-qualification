import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Buttons keep their verb through the flow (§11). Four quiet variants, one
 * flagged variant for irreversible actions. Focus ring comes from globals.css.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm border font-medium select-none transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-ink bg-ink text-paper hover:bg-ink/85 hover:border-ink/85",
        outline: "border-rule bg-paper text-ink hover:border-ink",
        ghost: "border-transparent bg-transparent text-ink hover:bg-rule/40",
        link: "h-auto rounded-none border-0 p-0 font-normal text-ink underline underline-offset-4 hover:no-underline",
        flag: "border-flag/40 bg-paper text-flag hover:border-flag",
      },
      size: {
        sm: "h-8 px-2.5 text-[13px]",
        default: "h-9 px-3.5 text-sm",
        lg: "h-11 px-5 text-[15px]",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
