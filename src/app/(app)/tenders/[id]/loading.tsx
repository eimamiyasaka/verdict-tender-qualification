/** Skeleton matching the tender header and verdict block (§12.7). */
export default function TenderLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy aria-label="Loading tender">
      <div className="flex flex-col gap-5">
        <div className="h-4 w-20 rounded-sm bg-rule/60" />
        <div className="h-7 w-3/4 max-w-lg rounded-sm bg-rule/60" />
        <div className="h-4 w-2/3 max-w-md rounded-sm bg-rule/60" />
        <div className="flex gap-6 border-b border-rule pb-3">
          <div className="h-4 w-20 rounded-sm bg-rule/60" />
          <div className="h-4 w-24 rounded-sm bg-rule/60" />
          <div className="h-4 w-20 rounded-sm bg-rule/60" />
          <div className="h-4 w-20 rounded-sm bg-rule/60" />
        </div>
      </div>
      <div className="min-h-[140px] rounded-sm bg-rule/40" />
      <div className="flex flex-col gap-3">
        <div className="h-3 w-24 rounded-sm bg-rule/60" />
        <div className="rounded-sm border border-rule">
          <div className="flex flex-col gap-2 border-b border-rule px-5 py-4">
            <div className="h-4 w-1/2 rounded-sm bg-rule/60" />
            <div className="h-3.5 w-2/3 rounded-sm bg-rule/60" />
            <div className="h-3 w-40 rounded-sm bg-rule/60" />
          </div>
          <div className="flex flex-col gap-2 px-5 py-4">
            <div className="h-4 w-1/2 rounded-sm bg-rule/60" />
            <div className="h-3.5 w-2/3 rounded-sm bg-rule/60" />
            <div className="h-3 w-40 rounded-sm bg-rule/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
