import { cn } from "@/lib/utils"

interface VuMeterProps {
  volume: number
  className?: string
}

export function VuMeter({ volume, className }: VuMeterProps) {
  const bars = 12
  const activeBars = Math.round(volume * bars)

  return (
    <div className={cn("flex items-end gap-px", className)}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-sm transition-all duration-75",
            i < activeBars
              ? i >= bars * 0.75
                ? "bg-red-500"
                : i >= bars * 0.5
                  ? "bg-yellow-500"
                  : "bg-green-500"
              : "bg-muted-foreground/20"
          )}
          style={{
            height: `${((i + 1) / bars) * 100}%`,
            minHeight: "4px",
            maxHeight: "24px",
          }}
        />
      ))}
    </div>
  )
}
