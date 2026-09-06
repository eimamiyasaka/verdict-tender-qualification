import { TenderCardSkeleton } from "@/components/pipeline/tender-card";

/** Skeleton rows matching the pipeline layout (§12.7). */
export default function PipelineLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy aria-label="Loading pipeline">
      <div className="flex items-end justify-between">
        <div className="h-7 w-32 rounded-sm bg-rule/60" />
        <div className="h-9 w-28 rounded-sm bg-rule/60" />
      </div>
      <div className="h-4 w-72 rounded-sm bg-rule/60" />
      <ul className="flex flex-col gap-3">
        <TenderCardSkeleton />
        <TenderCardSkeleton />
        <TenderCardSkeleton />
      </ul>
    </div>
  );
}
