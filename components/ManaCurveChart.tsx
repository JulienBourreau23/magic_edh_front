const BUCKET_ORDER = ["0", "1", "2", "3", "4", "5", "6", "7+"]

export function ManaCurveChart({ curve }: { curve: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(curve))

  return (
    <div className="flex items-end gap-1.5 h-32">
      {BUCKET_ORDER.map((bucket) => {
        const count = curve[bucket] ?? 0
        const heightPct = (count / max) * 100
        return (
          <div key={bucket} className="flex flex-1 flex-col items-center justify-end gap-1 h-full">
            <span className="text-xs tabular-nums text-muted-foreground">{count > 0 ? count : ""}</span>
            <div
              className="w-full rounded-t bg-primary/80"
              style={{ height: `${Math.max(heightPct, count > 0 ? 4 : 0)}%` }}
              title={`CMC ${bucket} : ${count} carte${count > 1 ? "s" : ""}`}
            />
            <span className="text-xs text-muted-foreground">{bucket}</span>
          </div>
        )
      })}
    </div>
  )
}
