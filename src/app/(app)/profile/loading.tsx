function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div className="h-5 w-40 rounded-sm bg-rule/60" />
        <div className="h-8 w-28 rounded-sm bg-rule/60" />
      </div>
      <div className="divide-y divide-rule rounded-sm border border-rule">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-6 px-4 py-3.5">
            <div className="h-4 w-1/3 rounded-sm bg-rule/60" />
            <div className="h-4 w-24 rounded-sm bg-rule/60" />
            <div className="h-4 w-28 rounded-sm bg-rule/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy aria-label="Loading profile">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded-sm bg-rule/60" />
        <div className="h-4 w-2/3 max-w-xl rounded-sm bg-rule/60" />
      </div>
      <div className="h-24 rounded-sm border border-rule" />
      <TableSkeleton rows={4} />
      <TableSkeleton rows={3} />
      <TableSkeleton rows={2} />
    </div>
  );
}
