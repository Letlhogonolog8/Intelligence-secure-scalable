import { useIsFetching, useIsMutating } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

export const GlobalLoadingIndicator = () => {
  const isFetching = useIsFetching()
  const isMutating = useIsMutating()
  const active = isFetching + isMutating > 0

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-0.5 bg-slate-900 transition-opacity",
        active ? "opacity-100" : "opacity-0"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="h-full bg-indigo-400 animate-pulse" />
    </div>
  )
}
