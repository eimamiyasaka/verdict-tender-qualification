"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import {
  guessDocType,
  runExtraction,
  screenSelection,
  type ItemProgress,
  type UploadItem,
} from "@/lib/ingest/run-extraction";
import { DOCUMENT_TYPES, MAX_DOCUMENTS_PER_TENDER, MAX_UPLOAD_BYTES } from "../../../contracts";
import type { DocumentType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Picked extends UploadItem {
  error: string | null;
}

/**
 * Multi-document upload typed by role (§8 step 1). Files over the limit are
 * rejected client-side before anything is parsed, with the size named, and a
 * pack over six documents is rejected with the count named — both messages
 * come from contracts.ts. Progress is per document and per chunk; a failed
 * chunk is shown as a count, never hidden behind a completed document.
 */
export function UploadPanel({ tenderId, existingCount }: { tenderId: string; existingCount: number }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [picked, setPicked] = React.useState<Picked[]>([]);
  const [finished, setFinished] = React.useState<Picked[]>([]);
  const [progress, setProgress] = React.useState<Record<string, ItemProgress>>({});
  const [selectionError, setSelectionError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  // `existingCount` already includes documents added by the last run once the page refreshes.
  const remainingSlots = Math.max(0, MAX_DOCUMENTS_PER_TENDER - existingCount - picked.length);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    setFinished([]);
    setProgress({});
    setPicked((current) => {
      const fresh = incoming.filter(
        (file) => !current.some((p) => p.file.name === file.name && p.file.size === file.size),
      );
      const screened = screenSelection(
        [...current.map((p) => p.file), ...fresh],
        existingCount,
      );
      setSelectionError(screened.selectionError);
      return screened.files.map((entry, index) => {
        const existing = current[index];
        return {
          id:
            existing?.id ??
            `${entry.file.name}-${entry.file.size}-${entry.file.lastModified}`,
          file: entry.file,
          docType: existing?.docType ?? guessDocType(entry.file.name),
          error: entry.error,
        };
      });
    });
  }

  function remove(id: string) {
    setPicked((current) => {
      const next = current.filter((p) => p.id !== id);
      const screened = screenSelection(next.map((p) => p.file), existingCount);
      setSelectionError(screened.selectionError);
      return next;
    });
  }

  function setType(id: string, docType: DocumentType) {
    setPicked((current) => current.map((p) => (p.id === id ? { ...p, docType } : p)));
  }

  async function start() {
    const valid = picked.filter((p) => !p.error);
    if (valid.length === 0 || selectionError) return;
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
          Up to {MAX_DOCUMENTS_PER_TENDER} PDFs per tender, {MAX_UPLOAD_BYTES / (1024 * 1024)} MB each,
          text-based. Files are read in your browser; only their text is sent for extraction and the file
          itself is not stored.
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

      {selectionError ? (
        <p role="alert" className="text-[13px] leading-relaxed text-flag">
          {selectionError}
        </p>
      ) : null}

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
          <Button
            type="button"
            onClick={start}
            disabled={running || validCount === 0 || Boolean(selectionError)}
            aria-busy={running}
          >
            {running
              ? "Extracting requirements…"
              : `Extract requirements from ${validCount} ${validCount === 1 ? "file" : "files"}`}
          </Button>
          {!running ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPicked([]);
                setSelectionError(null);
              }}
            >
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
      text = state.pageCount ? `Reading pages… ${state.pagesRead} of ${state.pageCount}` : "Opening the PDF…";
      break;
    case "extracting":
      text = (
        <>
          Extracting… {state.chunksDone} of {state.chunksTotal} chunks
          {state.chunksFailed > 0 ? <span className="text-flag"> · {state.chunksFailed} failed</span> : null}
        </>
      );
      break;
    case "saving":
      text = "Saving requirements…";
      break;
    case "complete": {
      const { outcome } = state;
      tone = "text-ink";
      text = state.message ? (
        <span className="text-pending">{state.message}</span>
      ) : (
        <>
          Done — {outcome.requirementsCreated}{" "}
          {outcome.requirementsCreated === 1 ? "requirement" : "requirements"}
          {outcome.citationsCreated > 0 ? `, ${outcome.citationsCreated} merged as extra citations` : ""}
          {outcome.draftsHeldForReview > 0 ? `, ${outcome.draftsHeldForReview} held for review` : ""}
          {outcome.draftsRejected > 0 ? `, ${outcome.draftsRejected} rejected` : ""}
          {state.keyDatesCreated > 0 ? `, ${state.keyDatesCreated} key dates` : ""}
          {outcome.chunksFailed > 0 ? (
            <span className="text-flag">
              {" "}
              · {outcome.chunksFailed} of {outcome.chunksTotal} chunks failed
            </span>
          ) : null}
        </>
      );
      break;
    }
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
