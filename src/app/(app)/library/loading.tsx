export default function LibraryLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy aria-label="Loading library">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-44 rounded-sm bg-rule/60" />
          <div className="h-4 w-96 max-w-full rounded-sm bg-rule/60" />
        </div>
        <div className="h-9 w-28 rounded-sm bg-rule/60" />
      </div>
      <div className="h-9 w-full max-w-sm rounded-sm bg-rule/60" />
      <div className="divide-y divide-rule rounded-sm border border-rule">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col gap-2 px-5 py-4">
            <div className="h-4 w-1/2 rounded-sm bg-rule/60" />
            <div className="h-3.5 w-5/6 rounded-sm bg-rule/60" />
            <div className="h-3 w-40 rounded-sm bg-rule/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
