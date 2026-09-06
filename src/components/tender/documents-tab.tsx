import { Cite } from "@/components/common/typography";
import { DeleteDocumentForm } from "@/components/tender/delete-document-form";
import { UploadPanel } from "@/components/upload/upload-panel";
import { DOCUMENT_TYPE_LABEL, EXTRACTION_STATUS_LABEL } from "@/lib/labels";
import { MAX_FILES } from "@/lib/ingest/run-extraction";
import type { TenderDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Documents tab (§10.2): filename, type, page count, extraction status,
 * requirements-found count, and for a failed extraction the stored
 * extractionError shown in full. Failed chunk counts are never hidden.
 */
export function DocumentsTab({ detail, closed }: { detail: TenderDetail; closed: boolean }) {
  const { documents, tender } = detail;

  return (
    <div className="flex flex-col gap-8">
      {documents.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-8 text-center text-sm text-ink/70">
          No documents yet. Add the pack below — the PSQ and ITT first, then anything else the buyer issued.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[11px] tracking-wide text-ink/60 uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium">Document</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Pages</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Extraction</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Requirements</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {documents.map((doc) => {
                const found = detail.requirementCountByDocument[doc.id] ?? 0;
                const failedChunks = detail.failedChunksByDocument[doc.id] ?? 0;
                const status = doc.extractionStatus;
                return (
                  <tr key={doc.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-mono text-[13px] text-ink">{doc.filename}</p>
                      {doc.filePath ? (
                        <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="rounded-sm font-mono text-[12px] text-ink/60 underline-offset-4 hover:text-ink hover:underline">
                          Open PDF ↗
                        </a>
                      ) : (
                        <Cite>Source file not retained</Cite>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink/80">{DOCUMENT_TYPE_LABEL[doc.docType]}</td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] whitespace-nowrap text-ink/80">{doc.pageCount ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className={cn("font-mono text-[12px] tracking-wide uppercase", status === "failed" ? "text-flag" : status === "complete" ? "text-ink/70" : "text-pending")}>
                        {EXTRACTION_STATUS_LABEL[status]}
                      </p>
                      {status === "failed" && doc.extractionError ? <p className="mt-1 max-w-md text-[13px] leading-relaxed text-flag">{doc.extractionError}</p> : null}
                      {status === "complete" && failedChunks > 0 ? (
                        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-flag">
                          {failedChunks} {failedChunks === 1 ? "chunk" : "chunks"} failed during extraction and {failedChunks === 1 ? "was" : "were"} not retried. Requirements from those pages may be missing — re-upload the file to extract again.
                        </p>
                      ) : null}
                      {status === "complete" && found === 0 && failedChunks === 0 ? (
                        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-pending">
                          No requirements found in this document — check it&apos;s the right file, or the type tag.
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] whitespace-nowrap text-ink">{status === "complete" ? found : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {!closed ? <DeleteDocumentForm tenderId={tender.id} documentId={doc.id} filename={doc.filename} requirementCount={found} /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {closed ? (
        <p className="text-sm text-ink/70">The submission deadline has passed, so no more documents can be added.</p>
      ) : documents.length >= MAX_FILES ? (
        <p className="text-sm text-ink/70">This tender has its full set of {MAX_FILES} documents. Remove one to add another.</p>
      ) : (
        <UploadPanel tenderId={tender.id} existingCount={documents.length} />
      )}
    </div>
  );
}
