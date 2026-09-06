"use client";

import * as React from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Cite, SourceRef } from "@/components/common/typography";
import { OBLIGATION_LABEL, REQUIREMENT_KIND_LABEL } from "@/lib/labels";
import type { RequirementWithSources } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The citation drawer (§10.2, §12.6) — the trust device. Any [view] control
 * anywhere on a tender page opens it with the requirement's verbatim clause.
 *
 * Radix Dialog gives the focus trap, Escape and focus return to the control
 * that opened it. The 320ms slide lives in globals.css and is the only
 * animation in the application.
 */

interface CitationContextValue {
  open: (requirement: RequirementWithSources) => void;
}

const CitationContext = React.createContext<CitationContextValue | null>(null);

export function CitationProvider({ children }: { children: React.ReactNode }) {
  const [requirement, setRequirement] = React.useState<RequirementWithSources | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  // The control that opened the drawer. Radix's modal dialog focuses its
  // Trigger on close; there is no Trigger here, so focus is returned by hand.
  const openerRef = React.useRef<HTMLElement | null>(null);

  const open = React.useCallback((r: RequirementWithSources) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRequirement(r);
    setIsOpen(true);
  }, []);

  const value = React.useMemo(() => ({ open }), [open]);

  return (
    <CitationContext.Provider value={value}>
      {children}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
        >
          {requirement ? <CitationDrawerBody requirement={requirement} /> : null}
        </DrawerContent>
      </Drawer>
    </CitationContext.Provider>
  );
}

export function useCitation(): CitationContextValue {
  const ctx = React.useContext(CitationContext);
  if (!ctx) throw new Error("useCitation must be used inside CitationProvider");
  return ctx;
}

/** The `[view]` control. Mono, quiet, and the thing focus returns to when the drawer closes. */
export function ViewSourceButton({
  requirement,
  label = "view",
  className,
}: {
  requirement: RequirementWithSources;
  label?: string;
  className?: string;
}) {
  const { open } = useCitation();
  return (
    <button
      type="button"
      onClick={() => open(requirement)}
      aria-label={`View clause for ${requirement.summary}: ${requirement.document.filename} page ${requirement.pageNumber}`}
      className={cn(
        "inline-flex items-center rounded-sm font-mono text-[12px] text-ink/60 underline-offset-4 hover:text-ink hover:underline",
        className,
      )}
    >
      [{label}]
    </button>
  );
}

/** A source reference that is itself the control: `PSQ.pdf · p.31 · §4.2.1` opens the drawer. */
export function SourceLink({ requirement, className }: { requirement: RequirementWithSources; className?: string }) {
  const { open } = useCitation();
  return (
    <button
      type="button"
      onClick={() => open(requirement)}
      aria-label={`View clause: ${requirement.document.filename} page ${requirement.pageNumber}${requirement.clauseReference ? ` ${requirement.clauseReference}` : ""}`}
      className={cn("rounded-sm text-left underline-offset-4 hover:underline", className)}
    >
      <SourceRef
        filename={requirement.document.filename}
        pageNumber={requirement.pageNumber}
        clauseReference={requirement.clauseReference}
      />
    </button>
  );
}

function pdfHref(filePath: string, page: number): string {
  return `${filePath}#page=${page}`;
}

function CitationDrawerBody({ requirement }: { requirement: RequirementWithSources }) {
  const { document } = requirement;
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-1 flex-col gap-6 px-6 pt-6 pb-8 sm:px-8">
        {/* 1. Document and page, mono 12px */}
        <DrawerDescription asChild>
          <p className="pr-8 font-mono text-[12px] text-ink/60">
            {document.filename}
            <span aria-hidden> · </span>
            <span className="sr-only">page </span>p.{requirement.pageNumber}
          </p>
        </DrawerDescription>

        {/* 2. The verbatim clause — the most vertical space in the panel */}
        <blockquote className="border-l-2 border-rule pl-5 text-[17px] leading-[1.6] text-ink">
          {requirement.quotedClause}
        </blockquote>

        {/* 3. Clause reference */}
        {requirement.clauseReference ? (
          <p className="font-mono text-[12px] text-ink/60">Clause {requirement.clauseReference}</p>
        ) : null}

        {/* 4. Requirement summary and obligation */}
        <div className="border-t border-rule pt-5">
          <DrawerTitle asChild>
            <h2 className="text-[15px] font-semibold text-ink">{requirement.summary}</h2>
          </DrawerTitle>
          <p className="mt-1 text-[13px] text-ink/70">
            {OBLIGATION_LABEL[requirement.obligation]} · {REQUIREMENT_KIND_LABEL[requirement.kind]}
            {requirement.extractionConfidence !== null ? (
              <>
                {" · "}
                <span className="font-mono text-[12px]">confidence {requirement.extractionConfidence.toFixed(2)}</span>
              </>
            ) : null}
          </p>
        </div>

        {/* 5. Additional citations */}
        {requirement.citations.length > 0 ? (
          <div className="border-t border-rule pt-5">
            <p className="section-label text-ink/60">Also stated in</p>
            <ul className="mt-3 flex flex-col gap-4">
              {requirement.citations.map((c) => (
                <li key={c.id} className="flex flex-col gap-2">
                  <SourceRef filename={c.document.filename} pageNumber={c.pageNumber} clauseReference={c.clauseReference} />
                  <blockquote className="border-l-2 border-rule pl-4 text-[14px] leading-relaxed text-ink/85">
                    {c.quotedClause}
                  </blockquote>
                  {c.document.filePath ? (
                    <a
                      href={pdfHref(c.document.filePath, c.pageNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="self-start rounded-sm font-mono text-[12px] text-ink/70 underline underline-offset-4 hover:text-ink"
                    >
                      Open {c.document.filename} at page {c.pageNumber}
                    </a>
                  ) : (
                    <Cite>Source file not retained — clause text above is verbatim.</Cite>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* 6. Open the PDF, or say plainly why you can't */}
      <div className="sticky bottom-0 border-t border-rule bg-paper px-6 py-4 sm:px-8">
        {document.filePath ? (
          <a
            href={pdfHref(document.filePath, requirement.pageNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-sm border border-ink bg-ink px-3.5 text-sm font-medium text-paper hover:bg-ink/85"
          >
            Open {document.filename} at page {requirement.pageNumber}
            <span aria-hidden>↗</span>
          </a>
        ) : (
          <Cite>Source file not retained — clause text above is verbatim.</Cite>
        )}
      </div>
    </div>
  );
}
