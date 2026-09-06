"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import { guessDocType, MAX_FILES, MAX_UPLOAD_BYTES, runExtraction, type ItemProgress, type UploadItem } from "@/lib/ingest/run-extraction";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Picked extends UploadItem {
  error: string | null;
}

/**
 * Multi-document upload typed by role (§8 step 1). Files over 20MB are
 * rejected client-side with the size named (§14). Progress is per document
 * and per chunk; errors are the stored messages, in full. Finished files move
 * to a results list so they are never extracted twice by accident.
 */
export function UploadPanel({ tenderId, existingCount }: { tenderId: string; existingCount: number }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [picked, setPicked] = React.useState<Picked[]>([]);
  const [finished, setFinished] = React.useState<Picked[]>([]);
  const [progress, setProgress] = React.useState<Record<string, ItemProgress>>({});
  const [running, setRunning] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  // `existingCount` already includes documents added by the last run once the page refreshes.
  const remainingSlots = Math.max(0, MAX_FILES - existingCount - picked.length);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    setFinished([]);
    setProgress({});
    setPicked((current) => {
      const next = [...current];
      for (const file of incoming) {
        if (next.length >= MAX_FILES - existingCount) break;
        if (next.some((p) => p.file.name === file.name && p.file.size === file.size)) continue;
        let error: string | null = null;
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        if (!isPdf) error = "Not a PDF. Verdict reads PDF packs only.";
        else if (file.size > MAX_UPLOAD_BYTES)
          error = `${formatBytes(file.size)} is over the 20 MB limit. Split the pack or ask the buyer for a smaller file.`;
        next.push({ id: `${file.name}-${file.size}-${file.lastModified}`, file, docType: guessDocType(file.name), error });
      }
      return next;
    });
  }

  function remove(id: string) {
    setPicked((current) => current.filter((p) => p.id !== id));
  }

  function setType(id: string, docType: DocumentType) {
    setPicked((current) => current.map((p) => (p.id === id ? { ...p, docType } : p)));
  }

  async function start() {
    const valid = picked.filter((p) => !p.error);
    if (valid.length === 0) return;
    setRunning(true);
    setProgress(Object.fromEntries(valid.map((v) => [v.id, { stage: "queued" } as ItemProgress])));
    try {
      await runExtraction(tenderId, valid, {
        onProgress: (id, p) => setProgress((current) => ({ ...current, [id]: p })),
      });
    } finally {
      setRunning(false);
      setFinished(valid);
      setPicked((current) => current.filter((p) => p.error));
      router.refresh();
    }
  }

  const validCount = picked.filter((p) => !p.error).length;
  const showPicker = remainingSlots > 0 && !running;

  return (
    <section aria-labelledby="upload-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="upload-heading" className="section-label text-ink/60">
          Add documents
        </h2>
        <p className="mt-1 text-[13px] text-ink/70">
          Up to {MAX_FILES} PDFs per tender, 20 MB each, text-based. Files are read in your browser; only their text is sent for
          extraction and the file itself is not stored.
        </p>
      </div>

      {finished.length > 0 ? (
        <ul className="divide-y divide-rule rounded-sm border border-rule" aria-label="Extraction results">
          {finished.map((f) => (
            <li key={f.id} className="px-4 py-3">
              <p className="truncate font-mono text-[13px] text-ink" title={f.file.name}>
                {f.file.name}
              </p>
              {progress[f.id] ? <ProgressLine state={progress[f.id]} /> : null}
            </li>
          ))}
          <li className="px-4 py-3">
            <p role="status" className="text-sm text-ink/80">
              Extraction complete. The table above is up to date; run the assessment from the Assessment tab.
            </p>
          </li>
        </ul>
      ) : null}

      <div
        role="group"
        aria-label="Choose PDF files"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (showPicker) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-ink bg-rule/30" : "border-rule",
          !showPicker && "opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          disabled={!showPicker}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" disabled={!showPicker} onClick={() => inputRef.current?.click()}>
          Choose PDFs
        </Button>
        <p className="text-[13px] text-ink/60">
          {remainingSlots === 0
            ? "This tender has its full set of documents."
            : `or drop them here · ${remainingSlots} more can be added`}
        </p>
      </div>

      {picked.length > 0 ? (
        <ul className="divide-y divide-rule rounded-sm border border-rule" aria-label="Files to extract">
          {picked.map((p) => {
            const state = progress[p.id];
            return (
              <li key={p.id} className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[1fr_14rem_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[13px] text-ink" title={p.file.name}>
                    {p.file.name}
                  </p>
                  <p className="text-[12px] text-ink/60">{formatBytes(p.file.size)}</p>
                  {p.error ? <p className="mt-1 text-[13px] text-flag">{p.error}</p> : null}
                  {state ? <ProgressLine state={state} /> : null}
                </div>
                <label className="flex items-center gap-2 text-[12px] text-ink/60">
                  <span className="sr-only">Document type for {p.file.name}</span>
                  <select
                    value={p.docType}
                    onChange={(e) => setType(p.id, e.target.value as DocumentType)}
                    disabled={running || Boolean(p.error)}
                    className="h-8 w-full rounded-sm border border-rule bg-paper px-2 text-[13px] text-ink hover:border-ink/60 focus:border-ink disabled:opacity-50"
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {DOCUMENT_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={running}
                  aria-label={`Remove ${p.file.name} from the upload`}
                  className="justify-self-start rounded-sm font-mono text-[12px] text-ink/60 underline-offset-4 hover:text-ink hover:underline disabled:opacity-50 sm:justify-self-end"
                >
                  [remove]
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {picked.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={start} disabled={running || validCount === 0} aria-busy={running}>
            {running
              ? "Extracting requirements…"
              : `Extract requirements from ${validCount} ${validCount === 1 ? "file" : "files"}`}
          </Button>
          {!running ? (
            <Button type="button" variant="ghost" onClick={() => setPicked([])}>
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ProgressLine({ state }: { state: ItemProgress }) {
  let text: React.ReactNode;
  let tone = "text-ink/70";
  switch (state.stage) {
    case "queued":
      text = "Waiting…";
      break;
    case "registering":
      text = "Adding to the tender…";
      break;
    case "reading":
      text = state.total ? `Reading pages… ${state.done} of ${state.total}` : "Opening the PDF…";
      break;
    case "extracting":
      text = (
        <>
          Extracting… {state.done} of {state.total} chunks
          {state.failed > 0 ? <span className="text-flag"> · {state.failed} failed</span> : null}
        </>
      );
      break;
    case "recording":
      text = "Saving requirements…";
      break;
    case "complete":
      tone = "text-ink";
      text =
        state.requirementsFound === 0 && state.citationsAdded === 0 ? (
          "No requirements found in this document — check it's the right file, or the type tag."
        ) : (
          <>
            Done — {state.requirementsFound} {state.requirementsFound === 1 ? "requirement" : "requirements"}
            {state.citationsAdded > 0 ? `, ${state.citationsAdded} merged as extra citations` : ""}
            {state.heldForReview > 0 ? `, ${state.heldForReview} held for review` : ""}
            {state.failedChunks > 0 ? (
              <span className="text-flag">
                {" "}
                · {state.failedChunks} of {state.chunkCount} chunks failed
              </span>
            ) : null}
          </>
        );
      break;
    case "failed":
      tone = "text-flag";
      text = state.message;
      break;
  }
  return (
    <p className={cn("mt-1 text-[13px]", tone)} aria-live="polite">
      {text}
    </p>
  );
}
