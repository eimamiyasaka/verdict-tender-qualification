"use client";

import * as React from "react";
import { Dialog as DrawerPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The right-hand drawer used for citations (§12.6). Radix Dialog supplies the
 * focus trap, Escape-to-close and focus return to the control that opened it.
 * The slide is 320ms ease-out and is the only animation in the application;
 * globals.css collapses it under prefers-reduced-motion. Under 640px it is a
 * full-screen sheet.
 */
function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay
        data-slot="drawer-overlay"
        className="fixed inset-0 z-50 bg-ink/20 data-[state=closed]:animate-veil-out data-[state=open]:animate-veil-in"
      />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-rule bg-paper text-ink outline-none data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in sm:w-[440px] sm:max-w-[calc(100vw-3rem)]",
          className,
        )}
        {...props}
      >
        {children}
        <DrawerPrimitive.Close
          data-slot="drawer-close"
          className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-sm text-ink/60 hover:bg-rule/40 hover:text-ink"
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </DrawerPrimitive.Close>
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title data-slot="drawer-title" className={cn(className)} {...props} />;
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description data-slot="drawer-description" className={cn(className)} {...props} />
  );
}

export { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger };
